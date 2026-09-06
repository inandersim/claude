import { generateId } from '@/core/utils/format';
import type { TelemedRepository } from '@/data/repositories';
import {
  buildConsultSummary,
  canSend,
  CONSULT_URGENCIES,
  detectCountry,
  doctorDisplayName,
  doctorGreeting,
  doctorReplyFor,
  guessLocale,
  isConsultOpen,
  localTriage,
  matchDoctors,
  sortDoctorsForList,
  specialtyFor,
  type Consultation,
  type ConsultationWithDetails,
  type ConsultMessage,
  type ConsultUrgency,
  type Doctor,
  type DoctorSpecialty,
  type DoctorWithUser,
  type ID,
  type TriageSpeciesHint,
  type User,
} from '@/domain';

import type { MockContext } from '../context';
import type { Tables } from '../database';

/** Doktorun talebi kabul etmesi 3–6 sn sürer. */
const ACCEPT_DELAY_MS: [number, number] = [3000, 6000];
/** Hasta mesajına doktor yanıtı 2–4 sn sürer. */
const REPLY_DELAY_MS: [number, number] = [2000, 4000];
const REMOTE_TRIAGE_TIMEOUT_MS = 15_000;

const randomBetween = ([min, max]: [number, number]) => min + Math.random() * (max - min);

/** Uzaktan triyaj yanıtını doğrular; biçim bozuksa null. */
function parseRemoteTriage(json: unknown): {
  urgency: ConsultUrgency;
  steps: string[];
  firstAidSlug: string | null;
  callEmergency: boolean;
} | null {
  if (typeof json !== 'object' || json === null) return null;
  const o = json as Record<string, unknown>;
  const urgency = o.urgency;
  if (typeof urgency !== 'string' || !(CONSULT_URGENCIES as readonly string[]).includes(urgency))
    return null;
  const steps = Array.isArray(o.steps)
    ? o.steps.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 8)
    : [];
  if (steps.length === 0) return null;
  return {
    urgency: urgency as ConsultUrgency,
    steps,
    firstAidSlug: typeof o.firstAidSlug === 'string' ? o.firstAidSlug : null,
    callEmergency:
      typeof o.callEmergency === 'boolean'
        ? o.callEmergency
        : urgency === 'high' || urgency === 'critical',
  };
}

/**
 * Tele-tıp mock repository'si. Doktor tarafı simüle edilir: talep kısa süre sonra
 * otomatik kabul edilir ve hasta mesajlarına kural tabanlı talimatlar döner.
 */
export function createTelemedRepository(ctx: MockContext): TelemedRepository {
  const timers = new Set<ReturnType<typeof setTimeout>>();

  /** Gecikmeli simülasyon adımı; Node/Jest'te süreci açık tutmaz. */
  const schedule = (ms: number, fn: () => Promise<void>) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn().catch(() => undefined);
    }, ms);
    if (typeof timer === 'object' && timer && 'unref' in timer) timer.unref();
    timers.add(timer);
  };

  const withUser = (t: Tables, d: Doctor): DoctorWithUser => ({
    ...d,
    user: ctx.requireUser(t.users, d.userId),
  });

  const findDoctor = (t: Tables, id: ID | null): DoctorWithUser | null => {
    if (!id) return null;
    const d = t.doctors.find((x) => x.id === id);
    return d ? withUser(t, d) : null;
  };

  const findConsult = (t: Tables, id: ID): Consultation => {
    const c = t.consultations.find((x) => x.id === id);
    if (!c) throw new Error(`Danışma bulunamadı: ${id}`);
    return c;
  };

  const messagesOf = (t: Tables, consultationId: ID): (ConsultMessage & { sender: User })[] =>
    t.consultMessages
      .filter((m) => m.consultationId === consultationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((m) => ({ ...m, sender: ctx.requireUser(t.users, m.senderId) }));

  const details = (t: Tables, c: Consultation): ConsultationWithDetails => ({
    ...c,
    patient: ctx.requireUser(t.users, c.patientId),
    doctor: findDoctor(t, c.doctorId),
    messages: messagesOf(t, c.id),
  });

  const isParticipant = (t: Tables, c: Consultation, meId: ID): boolean => {
    if (c.patientId === meId) return true;
    const d = t.doctors.find((x) => x.id === c.doctorId);
    return d?.userId === meId;
  };

  const speciesHint = (t: Tables, speciesId: ID | null | undefined): TriageSpeciesHint | null => {
    if (!speciesId) return null;
    const s = t.species.find((x) => x.id === speciesId);
    return s ? { firstAidSlug: s.firstAidSlug, danger: s.danger, commonName: s.commonName } : null;
  };

  const pushMessage = (
    t: Tables,
    consultationId: ID,
    senderId: ID,
    content: string,
    opts: { imageUrl?: string | null; isInstruction?: boolean } = {},
  ): ConsultMessage => {
    const msg: ConsultMessage = {
      id: generateId('cm'),
      consultationId,
      senderId,
      content,
      imageUrl: opts.imageUrl ?? null,
      isInstruction: opts.isInstruction ?? false,
      createdAt: new Date().toISOString(),
    };
    t.consultMessages.push(msg);
    return msg;
  };

  /** Doktor kabulü simülasyonu: durum → active, ilk doktor mesajı, hastaya bildirim. */
  const scheduleAccept = (consultationId: ID, locale: string) =>
    schedule(randomBetween(ACCEPT_DELAY_MS), async () => {
      const t = await ctx.db.load();
      const c = t.consultations.find((x) => x.id === consultationId);
      if (!c || c.status !== 'requested') return;
      const doctor = findDoctor(t, c.doctorId);
      if (!doctor) return;
      c.status = 'active';
      c.acceptedAt = new Date().toISOString();
      const greeting = doctorGreeting(doctorDisplayName(doctor, doctor.user.displayName), locale);
      pushMessage(t, c.id, doctor.userId, greeting);
      ctx.db.markDirty();
      await ctx.pushNotification({
        type: 'message',
        senderId: doctor.userId,
        receiverId: c.patientId,
        message: greeting,
        postId: null,
        matchId: null,
        targetId: c.id,
      });
    });

  /** Hasta mesajına kural tabanlı doktor talimatı. */
  const scheduleReply = (consultationId: ID, patientText: string) =>
    schedule(randomBetween(REPLY_DELAY_MS), async () => {
      const t = await ctx.db.load();
      const c = t.consultations.find((x) => x.id === consultationId);
      if (!c || c.status !== 'active') return;
      const doctor = findDoctor(t, c.doctorId);
      if (!doctor) return;
      const reply = doctorReplyFor(patientText, guessLocale(patientText));
      pushMessage(t, c.id, doctor.userId, reply, { isInstruction: true });
      ctx.db.markDirty();
    });

  return {
    async doctors(specialty = null, onlineOnly = false) {
      await ctx.wait();
      const t = await ctx.db.load();
      const list = t.doctors.filter(
        (d) => (!specialty || d.specialties.includes(specialty)) && (!onlineOnly || d.isOnline),
      );
      return sortDoctorsForList(list).map((d) => withUser(t, d));
    },

    async doctor(id) {
      await ctx.wait();
      const t = await ctx.db.load();
      return findDoctor(t, id);
    },

    async request(meId, input) {
      await ctx.wait();
      const t = await ctx.db.load();
      const me = ctx.requireUser(t.users, meId);
      const complaint = input.complaint.trim();
      if (complaint.length < 3) throw new Error('Şikâyet çok kısa');
      if (t.consultations.some((c) => c.patientId === meId && isConsultOpen(c.status)))
        throw new Error('Zaten devam eden bir danışmanız var');

      const locale = guessLocale(complaint);
      const triage = localTriage(complaint, locale, speciesHint(t, input.speciesId));
      const specialty: DoctorSpecialty = input.specialty ?? specialtyFor(triage);
      const countryCode = input.coords ? detectCountry(input.coords) : detectCountry(me.coords);
      const opts = { language: locale };
      const ranked = matchDoctors(t.doctors, specialty, input.urgency, countryCode, opts);
      const best =
        ranked[0] ??
        matchDoctors(t.doctors, specialty, input.urgency, countryCode, {
          ...opts,
          requireOnline: false,
        })[0] ??
        null;

      const consultation: Consultation = {
        id: generateId('cs'),
        patientId: meId,
        doctorId: best?.id ?? null,
        urgency: input.urgency,
        complaint,
        triage: triage.steps,
        firstAidSlug: input.firstAidSlug ?? triage.firstAidSlug,
        speciesId: input.speciesId ?? null,
        coords: input.coords ?? null,
        status: 'requested',
        channel: input.channel,
        createdAt: new Date().toISOString(),
        acceptedAt: null,
        endedAt: null,
        summary: null,
      };
      t.consultations.push(consultation);
      pushMessage(t, consultation.id, meId, complaint, { imageUrl: input.imageUri ?? null });
      ctx.db.markDirty();

      if (best) {
        await ctx.pushNotification({
          type: 'message',
          senderId: meId,
          receiverId: best.userId,
          message: complaint.slice(0, 120),
          postId: null,
          matchId: null,
          targetId: consultation.id,
        });
        scheduleAccept(consultation.id, locale);
      }
      return details(t, consultation);
    },

    async consultation(meId, id) {
      await ctx.wait();
      const t = await ctx.db.load();
      const c = t.consultations.find((x) => x.id === id);
      if (!c) return null;
      if (!isParticipant(t, c, meId)) throw new Error('Bu danışmaya erişiminiz yok');
      return details(t, c);
    },

    async myConsultations(meId) {
      await ctx.wait();
      const t = await ctx.db.load();
      return t.consultations
        .filter((c) => isParticipant(t, c, meId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((c) => details(t, c));
    },

    async send(meId, consultationId, content, imageUri = null) {
      await ctx.wait();
      const t = await ctx.db.load();
      const c = findConsult(t, consultationId);
      const doctor = t.doctors.find((x) => x.id === c.doctorId) ?? null;
      if (!canSend({ ...c, doctorUserId: doctor?.userId ?? null }, meId))
        throw new Error('Bu danışmaya mesaj gönderilemez');
      const text = content.trim();
      if (!text && !imageUri) throw new Error('Boş mesaj');
      const msg = pushMessage(t, c.id, meId, text, {
        imageUrl: imageUri,
        isInstruction: meId === doctor?.userId,
      });
      ctx.db.markDirty();
      if (meId === c.patientId && c.status === 'active' && doctor)
        scheduleReply(c.id, text || 'fotoğraf');
      return { ...msg, sender: ctx.requireUser(t.users, meId) };
    },

    async end(meId, consultationId, summary = null) {
      await ctx.wait();
      const t = await ctx.db.load();
      const c = findConsult(t, consultationId);
      if (!isParticipant(t, c, meId)) throw new Error('Bu danışmaya erişiminiz yok');
      if (!isConsultOpen(c.status)) throw new Error('Danışma zaten kapalı');
      const messages = messagesOf(t, c.id);
      c.status = 'completed';
      c.endedAt = new Date().toISOString();
      if (!c.acceptedAt) c.acceptedAt = c.createdAt;
      c.summary =
        summary?.trim() || buildConsultSummary(messages, guessLocale(c.complaint), c.patientId);
      ctx.db.markDirty();
      return details(t, c);
    },

    async cancel(meId, consultationId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const c = findConsult(t, consultationId);
      if (!isParticipant(t, c, meId)) throw new Error('Bu danışmaya erişiminiz yok');
      if (!isConsultOpen(c.status)) throw new Error('Danışma zaten kapalı');
      c.status = 'cancelled';
      c.endedAt = new Date().toISOString();
      ctx.db.markDirty();
    },

    async accept(doctorUserId, consultationId) {
      await ctx.wait();
      const t = await ctx.db.load();
      const c = findConsult(t, consultationId);
      if (c.status !== 'requested') throw new Error('Talep artık beklemede değil');
      const doctor = t.doctors.find((d) => d.userId === doctorUserId);
      if (!doctor) throw new Error('Doktor bulunamadı');
      c.doctorId = doctor.id;
      c.status = 'active';
      c.acceptedAt = new Date().toISOString();
      const user = ctx.requireUser(t.users, doctor.userId);
      pushMessage(
        t,
        c.id,
        doctor.userId,
        doctorGreeting(doctorDisplayName(doctor, user.displayName), guessLocale(c.complaint)),
      );
      ctx.db.markDirty();
      return details(t, c);
    },

    async triage(input) {
      const t = await ctx.db.load();
      const hint = speciesHint(t, input.speciesId);
      const local = localTriage(input.complaint, input.locale, hint);
      const baseUrl = process.env.EXPO_PUBLIC_AI_GATEWAY_URL?.trim();
      if (!baseUrl || typeof fetch !== 'function') return local;

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller
        ? setTimeout(() => controller.abort(), REMOTE_TRIAGE_TIMEOUT_MS)
        : null;
      try {
        const headers: Record<string, string> = {
          'content-type': 'application/json',
          accept: 'application/json',
        };
        const key = process.env.EXPO_PUBLIC_AI_GATEWAY_KEY?.trim();
        if (key) headers['x-zirtan-key'] = key;
        const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/triage`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            complaint: input.complaint,
            locale: input.locale,
            species: hint ? { commonName: hint.commonName, firstAidSlug: hint.firstAidSlug } : null,
          }),
          signal: controller?.signal,
        });
        if (!res.ok) return local;
        const remote = parseRemoteTriage(await res.json());
        return remote ?? local;
      } catch {
        return local;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
