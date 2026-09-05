import { generateId } from '@/core/utils/format';
import type { ClubRepository } from '@/data/repositories';
import {
  canRsvp,
  filterClubs,
  isApprovedMember,
  isStudentEmail,
  membershipOf,
  PENDING_JOIN,
  rankClubs,
  universityFromEmail,
  upcomingEvents,
  type Club,
  type ClubEvent,
  type ClubEventWithClub,
  type ClubMember,
  type ClubWithMembership,
  type ID,
  type StudentVerification,
} from '@/domain';

import type { MockContext } from '../context';
import type { Tables } from '../database';

/**
 * clubs modülü mock repository fabrikası.
 *
 * Üyelik kuralı: doğrulanmış kulüplere katılım önce **talep** (`joinedAt: ''`)
 * olarak kaydedilir; doğrulanmamış kulüplere doğrudan üye olunur. Talepler
 * `memberCount`'a dahil edilmez.
 */
export function createClubRepository(ctx: MockContext): ClubRepository {
  const { db, wait, requireUser } = ctx;

  const withMembership = (t: Tables, club: Club, meId: ID): ClubWithMembership => {
    const { status, role } = membershipOf(t.clubMembers, club.id, meId);
    const clubEvents = t.clubEvents.filter((e) => e.clubId === club.id);
    return {
      ...club,
      membership: status,
      role,
      upcomingEventCount: upcomingEvents(clubEvents, Date.now()).length,
    };
  };

  const withClub = (t: Tables, event: ClubEvent, meId: ID): ClubEventWithClub => {
    const club = t.clubs.find((c) => c.id === event.clubId);
    if (!club) throw new Error(`Kulüp bulunamadı: ${event.clubId}`);
    return {
      ...event,
      club,
      rsvped: t.eventRsvps.some((r) => r.userId === meId && r.eventId === event.id),
    };
  };

  const findClub = (t: Tables, id: ID): Club => {
    const club = t.clubs.find((c) => c.id === id);
    if (!club) throw new Error(`Kulüp bulunamadı: ${id}`);
    return club;
  };

  const findEvent = (t: Tables, id: ID): ClubEvent => {
    const event = t.clubEvents.find((e) => e.id === id);
    if (!event) throw new Error(`Etkinlik bulunamadı: ${id}`);
    return event;
  };

  const byStart = (a: ClubEvent, b: ClubEvent) =>
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();

  return {
    async list(meId, filter) {
      await wait();
      const t = await db.load();
      return filterClubs(t.clubs, filter).map((c) => withMembership(t, c, meId));
    },

    async getById(meId, id) {
      await wait();
      const t = await db.load();
      const club = t.clubs.find((c) => c.id === id);
      return club ? withMembership(t, club, meId) : null;
    },

    async members(clubId) {
      await wait();
      const t = await db.load();
      const order: Record<ClubMember['role'], number> = { president: 0, officer: 1, member: 2 };
      return t.clubMembers
        .filter((m) => m.clubId === clubId && isApprovedMember(m))
        .sort((a, b) => order[a.role] - order[b.role] || a.joinedAt.localeCompare(b.joinedAt))
        .map((m) => ({ ...requireUser(t.users, m.userId), role: m.role }));
    },

    async join(meId, clubId) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const club = findClub(t, clubId);
      const current = membershipOf(t.clubMembers, clubId, meId);
      if (current.status === 'member') throw new Error('Zaten bu kulübün üyesisin.');
      if (current.status === 'requested') throw new Error('Üyelik talebin zaten bekliyor.');
      const record: ClubMember = {
        clubId,
        userId: meId,
        role: 'member',
        joinedAt: club.isVerified ? PENDING_JOIN : new Date().toISOString(),
      };
      t.clubMembers.push(record);
      if (!club.isVerified) club.memberCount += 1;
      db.markDirty();
      return withMembership(t, club, meId);
    },

    async leave(meId, clubId) {
      await wait();
      const t = await db.load();
      const club = findClub(t, clubId);
      const idx = t.clubMembers.findIndex((m) => m.clubId === clubId && m.userId === meId);
      if (idx < 0) throw new Error('Bu kulübün üyesi değilsin.');
      const [removed] = t.clubMembers.splice(idx, 1);
      if (removed && isApprovedMember(removed)) {
        club.memberCount = Math.max(0, club.memberCount - 1);
      }
      db.markDirty();
      return withMembership(t, club, meId);
    },

    async events(meId, clubId = null) {
      await wait();
      const t = await db.load();
      const events = clubId ? t.clubEvents.filter((e) => e.clubId === clubId) : t.clubEvents;
      return [...events].sort(byStart).map((e) => withClub(t, e, meId));
    },

    async event(meId, eventId) {
      await wait();
      const t = await db.load();
      const event = t.clubEvents.find((e) => e.id === eventId);
      return event ? withClub(t, event, meId) : null;
    },

    async rsvp(meId, eventId) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const event = findEvent(t, eventId);
      const idx = t.eventRsvps.findIndex((r) => r.userId === meId && r.eventId === eventId);
      const membership = membershipOf(t.clubMembers, event.clubId, meId).status;
      const already = idx >= 0;
      if (!canRsvp(event, membership, Date.now(), already)) {
        throw new Error(
          already
            ? 'Geçmiş etkinlikte RSVP değiştirilemez.'
            : 'Bu etkinliğe katılım şu an mümkün değil.',
        );
      }
      if (already) {
        t.eventRsvps.splice(idx, 1);
        event.attendeeCount = Math.max(0, event.attendeeCount - 1);
      } else {
        t.eventRsvps.push({ userId: meId, eventId });
        event.attendeeCount += 1;
      }
      db.markDirty();
      return withClub(t, event, meId);
    },

    async createEvent(meId, input) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const club = findClub(t, input.clubId);
      const membership = membershipOf(t.clubMembers, club.id, meId);
      // Demo: yöneticiler ve üyeler etkinlik açabilir; talep/üye olmayanlar açamaz.
      if (membership.status !== 'member') {
        throw new Error('Etkinlik oluşturmak için kulüp üyesi olmalısın.');
      }
      const title = input.title.trim();
      if (!title) throw new Error('Etkinlik başlığı boş olamaz.');
      if (new Date(input.endsAt).getTime() < new Date(input.startsAt).getTime()) {
        throw new Error('Bitiş, başlangıçtan önce olamaz.');
      }
      const event: ClubEvent = {
        id: generateId('ce'),
        clubId: club.id,
        title,
        kind: input.kind,
        adventureType: input.adventureType,
        description: input.description.trim(),
        locationName: input.locationName.trim(),
        coords: null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        capacity: input.capacity !== null ? Math.max(1, Math.round(input.capacity)) : null,
        attendeeCount: 1,
        openToAll: input.openToAll,
        priceTry: Math.max(0, Math.round(input.priceTry)),
      };
      t.clubEvents.unshift(event);
      // Oluşturan kişi otomatik katılımcı.
      t.eventRsvps.push({ userId: meId, eventId: event.id });
      db.markDirty();
      return withClub(t, event, meId);
    },

    async ranking() {
      await wait();
      const t = await db.load();
      return rankClubs(t.clubs);
    },

    async studentVerification(meId) {
      await wait();
      const t = await db.load();
      return t.studentVerifications.find((v) => v.userId === meId) ?? null;
    },

    async verifyStudent(meId, email) {
      await wait();
      const t = await db.load();
      requireUser(t.users, meId);
      const normalized = email.trim().toLowerCase();
      if (!isStudentEmail(normalized)) {
        throw new Error('Bu e-posta bir üniversite adresi gibi görünmüyor.');
      }
      const university = universityFromEmail(normalized) ?? 'Üniversite';
      const record: StudentVerification = {
        userId: meId,
        email: normalized,
        university,
        // Demo: kod gönderimi simüle edilir, kayıt anında doğrulanmış sayılır.
        verifiedAt: new Date().toISOString(),
      };
      const idx = t.studentVerifications.findIndex((v) => v.userId === meId);
      if (idx >= 0) t.studentVerifications[idx] = record;
      else t.studentVerifications.push(record);
      db.markDirty();
      return record;
    },

    async myClubs(meId) {
      await wait();
      const t = await db.load();
      const ids = new Set(t.clubMembers.filter((m) => m.userId === meId).map((m) => m.clubId));
      return t.clubs
        .filter((c) => ids.has(c.id))
        .map((c) => withMembership(t, c, meId))
        .sort((a, b) => (a.membership === b.membership ? 0 : a.membership === 'member' ? -1 : 1));
    },
  };
}
