import {
  CONSULT_URGENCIES,
  buildConsultSummary,
  canSend,
  detectCountry,
  doctorDisplayName,
  doctorGreeting,
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
  type DoctorSpecialty,
  type DoctorWithUser,
  type ID,
  type TriageSpeciesHint,
  type User,
} from '@/domain';

import type { TelemedRepository } from '../../repositories';
import { PROFILE_SELECT, fetchUsers, notify, pickUser, requireUser, type RemoteContext } from '../context';
import { fromGeoPoint, toConsultMessage, toConsultation, toDoctor, toUser } from '../mappers';
import { maybeRow, oneRow, rows, type Row } from '../postgrest';

const REMOTE_TRIAGE_TIMEOUT_MS = 15_000;

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
  if (typeof urgency !== 'string' || !(CONSULT_URGENCIES as readonly string[]).includes(urgency)) {
    return null;
  }
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
 * Tele-tıp uzak repository'si.
 *
 * Mock'tan fark: doktor tarafı **simüle edilmez**. Talep `requested` durumunda
 * kalır; gerçek hekim `accept` ile devralır (bkz. docs/REMOTE_PROVIDER.md).
 */
export function createTelemedRepository(ctx: RemoteContext): TelemedRepository {
  const { db } = ctx;

  const doctorWithUser = async (row: Row): Promise<DoctorWithUser> => {
    const doctor = toDoctor(row);
    return { ...doctor, user: await requireUser(db, doctor.userId) };
  };

  const findDoctor = async (id: ID | null): Promise<DoctorWithUser | null> => {
    if (!id) return null;
    const row = await maybeRow(db.from('doctors').select('*').eq('id', id), 'doktor okunamadı');
    return row ? await doctorWithUser(row) : null;
  };

  const findConsult = async (id: ID): Promise<Consultation> => {
    const row = await maybeRow(
      db.from('consultations').select('*').eq('id', id),
      'danışma okunamadı',
    );
    if (!row) throw new Error(`Danışma bulunamadı: ${id}`);
    return toConsultation(row);
  };

  const messagesOf = async (
    consultationId: ID,
  ): Promise<(ConsultMessage & { sender: User })[]> => {
    const data = await rows(
      db
        .from('consult_messages')
        .select(`*, sender:profiles!sender_id(${PROFILE_SELECT})`)
        .eq('consultation_id', consultationId)
        .order('created_at', { ascending: true }),
      'mesajlar okunamadı',
    );
    return data.map((row) => ({
      ...toConsultMessage(row),
      sender: toUser((row.sender ?? {}) as Row),
    }));
  };

  const details = async (consultation: Consultation): Promise<ConsultationWithDetails> => {
    const [patients, doctor, messages] = await Promise.all([
      fetchUsers(db, [consultation.patientId]),
      findDoctor(consultation.doctorId),
      messagesOf(consultation.id),
    ]);
    return {
      ...consultation,
      patient: pickUser(patients, consultation.patientId),
      doctor,
      messages,
    };
  };

  const isParticipant = async (c: Consultation, meId: ID): Promise<boolean> => {
    if (c.patientId === meId) return true;
    if (!c.doctorId) return false;
    const doctor = await maybeRow(
      db.from('doctors').select('user_id').eq('id', c.doctorId),
      'doktor okunamadı',
    );
    return doctor ? String(doctor.user_id) === meId : false;
  };

  const speciesHint = async (speciesId: ID | null | undefined): Promise<TriageSpeciesHint | null> => {
    if (!speciesId) return null;
    const row = await maybeRow(
      db.from('species').select('first_aid_slug, danger, common_name').eq('id', speciesId),
      'tür okunamadı',
    );
    if (!row) return null;
    return {
      firstAidSlug: row.first_aid_slug ? String(row.first_aid_slug) : null,
      danger: String(row.danger) as TriageSpeciesHint['danger'],
      commonName: String(row.common_name),
    };
  };

  const pushMessage = async (
    consultationId: ID,
    senderId: ID,
    content: string,
    opts: { imageUrl?: string | null; isInstruction?: boolean } = {},
  ): Promise<ConsultMessage> => {
    const created = await oneRow(
      db
        .from('consult_messages')
        .insert({
          consultation_id: consultationId,
          sender_id: senderId,
          content,
          image_url: opts.imageUrl ?? null,
          is_instruction: opts.isInstruction ?? false,
        })
        .select('*'),
      'mesaj gönderilemedi',
    );
    return toConsultMessage(created);
  };

  /**
   * `consultations.first_aid_slug` alanı `first_aid_guides` tablosuna yabancı
   * anahtardır; ilk yardım rehberleri ise uygulamada koddan gelir
   * (`src/data/content/firstAid.ts`) ve tabloya tohumlanmamıştır. Bu yüzden
   * yalnızca veritabanında karşılığı olan slug yazılır — triyaj adımları
   * `triage` alanında yine tam olarak saklanır.
   */
  const persistableSlug = async (slug: string | null): Promise<string | null> => {
    if (!slug) return null;
    const row = await maybeRow(
      db.from('first_aid_guides').select('slug').eq('slug', slug).limit(1),
      'ilk yardım rehberi okunamadı',
    );
    return row ? slug : null;
  };

  return {
    async doctors(specialty = null, onlineOnly = false) {
      let query = db.from('doctors').select('*');
      if (specialty) query = query.contains('specialties', [specialty]);
      if (onlineOnly) query = query.is('is_online', true);
      const data = await rows(query, 'doktorlar okunamadı');
      const doctors = data.map(toDoctor);
      const users = await fetchUsers(db, doctors.map((d) => d.userId));
      return sortDoctorsForList(doctors).flatMap<DoctorWithUser>((d) => {
        const user = users.get(d.userId);
        return user ? [{ ...d, user }] : [];
      });
    },

    async doctor(id) {
      return await findDoctor(id);
    },

    async request(meId, input) {
      const me = await requireUser(db, meId);
      const complaint = input.complaint.trim();
      if (complaint.length < 3) throw new Error('Şikâyet çok kısa');
      const open = await rows(
        db
          .from('consultations')
          .select('id')
          .eq('patient_id', meId)
          .in('status', ['requested', 'active']),
        'danışmalar okunamadı',
      );
      if (open.length) throw new Error('Zaten devam eden bir danışmanız var');

      const locale = guessLocale(complaint);
      const triage = localTriage(complaint, locale, await speciesHint(input.speciesId));
      const specialty: DoctorSpecialty = input.specialty ?? specialtyFor(triage);
      const countryCode = input.coords ? detectCountry(input.coords) : detectCountry(me.coords);
      const doctorRows = await rows(db.from('doctors').select('*'), 'doktorlar okunamadı');
      const doctors = doctorRows.map(toDoctor);
      const opts = { language: locale };
      const explicit = input.doctorId
        ? (doctors.find((d) => d.id === input.doctorId) ?? null)
        : null;
      const best =
        explicit ??
        matchDoctors(doctors, specialty, input.urgency, countryCode, opts)[0] ??
        matchDoctors(doctors, specialty, input.urgency, countryCode, {
          ...opts,
          requireOnline: false,
        })[0] ??
        null;

      const created = await oneRow(
        db
          .from('consultations')
          .insert({
            patient_id: meId,
            doctor_id: best?.id ?? null,
            urgency: input.urgency,
            complaint,
            triage: triage.steps,
            first_aid_slug: await persistableSlug(input.firstAidSlug ?? triage.firstAidSlug),
            species_id: input.speciesId ?? null,
            coords: fromGeoPoint(input.coords ?? null),
            status: 'requested',
            channel: input.channel,
          })
          .select('*'),
        'danışma oluşturulamadı',
      );
      const consultation = toConsultation(created);
      await pushMessage(consultation.id, meId, complaint, { imageUrl: input.imageUri ?? null });
      if (best) {
        await notify(db, {
          type: 'message',
          senderId: meId,
          receiverId: best.userId,
          message: complaint.slice(0, 120),
          postId: null,
          matchId: null,
          targetId: consultation.id,
        });
      }
      return await details(consultation);
    },

    async consultation(meId, id) {
      const row = await maybeRow(
        db.from('consultations').select('*').eq('id', id),
        'danışma okunamadı',
      );
      if (!row) return null;
      const consultation = toConsultation(row);
      if (!(await isParticipant(consultation, meId))) {
        throw new Error('Bu danışmaya erişiminiz yok');
      }
      return await details(consultation);
    },

    async myConsultations(meId) {
      const myDoctor = await maybeRow(
        db.from('doctors').select('id').eq('user_id', meId),
        'doktor okunamadı',
      );
      const filter = myDoctor
        ? `patient_id.eq.${meId},doctor_id.eq.${String(myDoctor.id)}`
        : `patient_id.eq.${meId}`;
      const data = await rows(
        db
          .from('consultations')
          .select('*')
          .or(filter)
          .order('created_at', { ascending: false }),
        'danışmalar okunamadı',
      );
      const out: ConsultationWithDetails[] = [];
      for (const row of data) out.push(await details(toConsultation(row)));
      return out;
    },

    async send(meId, consultationId, content, imageUri = null) {
      const consultation = await findConsult(consultationId);
      const doctor = await findDoctor(consultation.doctorId);
      if (!canSend({ ...consultation, doctorUserId: doctor?.userId ?? null }, meId)) {
        throw new Error('Bu danışmaya mesaj gönderilemez');
      }
      const text = content.trim();
      if (!text && !imageUri) throw new Error('Boş mesaj');
      const message = await pushMessage(consultationId, meId, text, {
        imageUrl: imageUri,
        isInstruction: meId === doctor?.userId,
      });
      return { ...message, sender: await requireUser(db, meId) };
    },

    async end(meId, consultationId, summary = null) {
      const consultation = await findConsult(consultationId);
      if (!(await isParticipant(consultation, meId))) {
        throw new Error('Bu danışmaya erişiminiz yok');
      }
      if (!isConsultOpen(consultation.status)) throw new Error('Danışma zaten kapalı');
      const messages = await messagesOf(consultationId);
      const nowIso = new Date().toISOString();
      const updated = await oneRow(
        db
          .from('consultations')
          .update({
            status: 'completed',
            ended_at: nowIso,
            accepted_at: consultation.acceptedAt ?? consultation.createdAt,
            summary:
              summary?.trim() ||
              buildConsultSummary(messages, guessLocale(consultation.complaint), consultation.patientId),
          })
          .eq('id', consultationId)
          .select('*'),
        'danışma kapatılamadı',
      );
      return await details(toConsultation(updated));
    },

    async cancel(meId, consultationId) {
      const consultation = await findConsult(consultationId);
      if (!(await isParticipant(consultation, meId))) {
        throw new Error('Bu danışmaya erişiminiz yok');
      }
      if (!isConsultOpen(consultation.status)) throw new Error('Danışma zaten kapalı');
      await rows(
        db
          .from('consultations')
          .update({ status: 'cancelled', ended_at: new Date().toISOString() })
          .eq('id', consultationId),
        'danışma iptal edilemedi',
      );
    },

    async accept(doctorUserId, consultationId) {
      const consultation = await findConsult(consultationId);
      if (consultation.status !== 'requested') throw new Error('Talep artık beklemede değil');
      const doctorRow = await maybeRow(
        db.from('doctors').select('*').eq('user_id', doctorUserId),
        'doktor okunamadı',
      );
      if (!doctorRow) throw new Error('Doktor bulunamadı');
      const doctor = await doctorWithUser(doctorRow);
      const updated = await oneRow(
        db
          .from('consultations')
          .update({
            doctor_id: doctor.id,
            status: 'active',
            accepted_at: new Date().toISOString(),
          })
          .eq('id', consultationId)
          .select('*'),
        'danışma kabul edilemedi',
      );
      await pushMessage(
        consultationId,
        doctor.userId,
        doctorGreeting(
          doctorDisplayName(doctor, doctor.user.displayName),
          guessLocale(consultation.complaint),
        ),
      );
      return await details(toConsultation(updated));
    },

    async triage(input) {
      const hint = await speciesHint(input.speciesId);
      // Yerel sonuç her zaman hazır: ağ geçidi yoksa ya da başarısız olursa bu döner.
      const local = {
        ...localTriage(input.complaint, input.locale, hint),
        source: 'local' as const,
      };
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
        return remote ? { ...remote, source: 'remote' as const } : local;
      } catch {
        return local;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
