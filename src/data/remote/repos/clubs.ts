import {
  PENDING_JOIN,
  canRsvp,
  filterClubs,
  isApprovedMember,
  isStudentEmail,
  membershipOf,
  rankClubs,
  universityFromEmail,
  upcomingEvents,
  type Club,
  type ClubEvent,
  type ClubEventWithClub,
  type ClubMember,
  type ClubRole,
  type ClubWithMembership,
  type ID,
} from '@/domain';

import type { ClubRepository } from '../../repositories';
import { fetchUsers, requireUser, type RemoteContext } from '../context';
import { iso, toClub, toClubEvent, toStudentVerification } from '../mappers';
import { maybeRow, oneRow, rows, type Row } from '../postgrest';

/**
 * clubs modülü uzak repository fabrikası.
 *
 * Üyelik kuralı mock ile aynıdır: doğrulanmış kulüplere katılım önce **talep**
 * (`joined_at IS NULL` ⇔ mock'ta `joinedAt: ''`) olarak kaydedilir.
 */
export function createClubRepository(ctx: RemoteContext): ClubRepository {
  const { db } = ctx;

  const toMember = (row: Row): ClubMember => ({
    clubId: String(row.club_id),
    userId: String(row.user_id),
    role: String(row.role ?? 'member') as ClubRole,
    joinedAt: row.joined_at == null ? PENDING_JOIN : iso(row.joined_at),
  });

  const membersOf = async (clubIds: readonly ID[]): Promise<ClubMember[]> => {
    if (!clubIds.length) return [];
    const data = await rows(
      db.from('club_members').select('*').in('club_id', clubIds),
      'kulüp üyeleri okunamadı',
    );
    return data.map(toMember);
  };

  const eventsOf = async (clubIds: readonly ID[]): Promise<ClubEvent[]> => {
    if (!clubIds.length) return [];
    const data = await rows(
      db.from('club_events').select('*').in('club_id', clubIds),
      'etkinlikler okunamadı',
    );
    return data.map(toClubEvent);
  };

  const withMembership = async (clubs: Club[], meId: ID): Promise<ClubWithMembership[]> => {
    const ids = clubs.map((c) => c.id);
    const [members, events] = await Promise.all([membersOf(ids), eventsOf(ids)]);
    const now = Date.now();
    return clubs.map((club) => {
      const { status, role } = membershipOf(members, club.id, meId);
      return {
        ...club,
        membership: status,
        role,
        upcomingEventCount: upcomingEvents(
          events.filter((e) => e.clubId === club.id),
          now,
        ).length,
      };
    });
  };

  const findClub = async (id: ID): Promise<Club> => {
    const row = await maybeRow(db.from('clubs').select('*').eq('id', id), 'kulüp okunamadı');
    if (!row) throw new Error(`Kulüp bulunamadı: ${id}`);
    return toClub(row);
  };

  const findEvent = async (id: ID): Promise<ClubEvent> => {
    const row = await maybeRow(
      db.from('club_events').select('*').eq('id', id),
      'etkinlik okunamadı',
    );
    if (!row) throw new Error(`Etkinlik bulunamadı: ${id}`);
    return toClubEvent(row);
  };

  const withClub = async (events: ClubEvent[], meId: ID): Promise<ClubEventWithClub[]> => {
    if (!events.length) return [];
    const clubIds = Array.from(new Set(events.map((e) => e.clubId)));
    const clubRows = await rows(
      db.from('clubs').select('*').in('id', clubIds),
      'kulüpler okunamadı',
    );
    const clubs = new Map(clubRows.map((row) => [String(row.id), toClub(row)]));
    const rsvps = await rows(
      db
        .from('event_rsvps')
        .select('event_id')
        .eq('user_id', meId)
        .in(
          'event_id',
          events.map((e) => e.id),
        ),
      'katılımlar okunamadı',
    );
    const mine = new Set(rsvps.map((row) => String(row.event_id)));
    return events.map((event) => {
      const club = clubs.get(event.clubId);
      if (!club) throw new Error(`Kulüp bulunamadı: ${event.clubId}`);
      return { ...event, club, rsvped: mine.has(event.id) };
    });
  };

  const byStart = (a: ClubEvent, b: ClubEvent) =>
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();

  const oneClub = async (clubId: ID, meId: ID): Promise<ClubWithMembership> => {
    const [result] = await withMembership([await findClub(clubId)], meId);
    if (!result) throw new Error(`Kulüp bulunamadı: ${clubId}`);
    return result;
  };

  const oneEvent = async (eventId: ID, meId: ID): Promise<ClubEventWithClub> => {
    const [result] = await withClub([await findEvent(eventId)], meId);
    if (!result) throw new Error(`Etkinlik bulunamadı: ${eventId}`);
    return result;
  };

  return {
    async list(meId, filter) {
      const data = await rows(db.from('clubs').select('*'), 'kulüpler okunamadı');
      return await withMembership(filterClubs(data.map(toClub), filter), meId);
    },

    async getById(meId, id) {
      const row = await maybeRow(db.from('clubs').select('*').eq('id', id), 'kulüp okunamadı');
      if (!row) return null;
      const [result] = await withMembership([toClub(row)], meId);
      return result ?? null;
    },

    async members(clubId) {
      const order: Record<ClubRole, number> = { president: 0, officer: 1, member: 2 };
      const members = (await membersOf([clubId])).filter(isApprovedMember);
      const users = await fetchUsers(
        db,
        members.map((m) => m.userId),
      );
      return members
        .sort((a, b) => order[a.role] - order[b.role] || a.joinedAt.localeCompare(b.joinedAt))
        .flatMap((m) => {
          const user = users.get(m.userId);
          return user ? [{ ...user, role: m.role }] : [];
        });
    },

    async join(meId, clubId) {
      await requireUser(db, meId);
      const club = await findClub(clubId);
      const current = membershipOf(await membersOf([clubId]), clubId, meId);
      if (current.status === 'member') throw new Error('Zaten bu kulübün üyesisin.');
      if (current.status === 'requested') throw new Error('Üyelik talebin zaten bekliyor.');
      await rows(
        db.from('club_members').insert({
          club_id: clubId,
          user_id: meId,
          role: 'member',
          status: club.isVerified ? 'requested' : 'member',
          joined_at: club.isVerified ? null : new Date().toISOString(),
        }),
        'kulübe katılınamadı',
      );
      if (club.isVerified) {
        // Bekleyen talep üye sayısına dahil edilmez; tetikleyicinin artışını geri al.
        const fresh = await oneRow(
          db.from('clubs').select('member_count').eq('id', clubId),
          'kulüp okunamadı',
        );
        await rows(
          db
            .from('clubs')
            .update({ member_count: Math.max(0, Number(fresh.member_count ?? 0) - 1) })
            .eq('id', clubId),
          'üye sayısı güncellenemedi',
        );
      }
      return await oneClub(clubId, meId);
    },

    async leave(meId, clubId) {
      await findClub(clubId);
      const member = (await membersOf([clubId])).find((m) => m.userId === meId);
      if (!member) throw new Error('Bu kulübün üyesi değilsin.');
      await rows(
        db.from('club_members').delete().eq('club_id', clubId).eq('user_id', meId),
        'kulüpten çıkılamadı',
      );
      if (!isApprovedMember(member)) {
        // Talep zaten sayılmıyordu; tetikleyicinin azaltmasını geri al.
        const fresh = await oneRow(
          db.from('clubs').select('member_count').eq('id', clubId),
          'kulüp okunamadı',
        );
        await rows(
          db
            .from('clubs')
            .update({ member_count: Number(fresh.member_count ?? 0) + 1 })
            .eq('id', clubId),
          'üye sayısı güncellenemedi',
        );
      }
      return await oneClub(clubId, meId);
    },

    async events(meId, clubId = null) {
      let query = db.from('club_events').select('*');
      if (clubId) query = query.eq('club_id', clubId);
      const data = await rows(query, 'etkinlikler okunamadı');
      return await withClub(data.map(toClubEvent).sort(byStart), meId);
    },

    async event(meId, eventId) {
      const row = await maybeRow(
        db.from('club_events').select('*').eq('id', eventId),
        'etkinlik okunamadı',
      );
      if (!row) return null;
      const [result] = await withClub([toClubEvent(row)], meId);
      return result ?? null;
    },

    async rsvp(meId, eventId) {
      await requireUser(db, meId);
      const event = await findEvent(eventId);
      const existing = await maybeRow(
        db.from('event_rsvps').select('event_id').eq('event_id', eventId).eq('user_id', meId),
        'katılım okunamadı',
      );
      const membership = membershipOf(await membersOf([event.clubId]), event.clubId, meId).status;
      const already = existing !== null;
      if (!canRsvp(event, membership, Date.now(), already)) {
        throw new Error(
          already
            ? 'Geçmiş etkinlikte RSVP değiştirilemez.'
            : 'Bu etkinliğe katılım şu an mümkün değil.',
        );
      }
      // `event_rsvps_count` sayacı ve `event_rsvps_award_xp` XP'si tetikleyicilerle işlenir.
      if (already) {
        await rows(
          db.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', meId),
          'katılım geri alınamadı',
        );
      } else {
        await rows(
          db.from('event_rsvps').insert({ event_id: eventId, user_id: meId }),
          'katılım kaydedilemedi',
        );
      }
      return await oneEvent(eventId, meId);
    },

    async createEvent(meId, input) {
      await requireUser(db, meId);
      const club = await findClub(input.clubId);
      const membership = membershipOf(await membersOf([club.id]), club.id, meId);
      if (membership.status !== 'member') {
        throw new Error('Etkinlik oluşturmak için kulüp üyesi olmalısın.');
      }
      const title = input.title.trim();
      if (!title) throw new Error('Etkinlik başlığı boş olamaz.');
      if (new Date(input.endsAt).getTime() < new Date(input.startsAt).getTime()) {
        throw new Error('Bitiş, başlangıçtan önce olamaz.');
      }
      const created = await oneRow(
        db
          .from('club_events')
          .insert({
            club_id: club.id,
            created_by: meId,
            title,
            kind: input.kind,
            adventure_type: input.adventureType,
            description: input.description.trim(),
            location_name: input.locationName.trim(),
            coords: null,
            starts_at: input.startsAt,
            ends_at: input.endsAt,
            capacity: input.capacity !== null ? Math.max(1, Math.round(input.capacity)) : null,
            attendee_count: 0,
            open_to_all: input.openToAll,
            price_try: Math.max(0, Math.round(input.priceTry)),
          })
          .select('*'),
        'etkinlik oluşturulamadı',
      );
      // Oluşturan kişi otomatik katılımcı (sayacı tetikleyici artırır).
      await rows(
        db.from('event_rsvps').insert({ event_id: String(created.id), user_id: meId }),
        'katılım kaydedilemedi',
      );
      return await oneEvent(String(created.id), meId);
    },

    async ranking() {
      const data = await rows(db.from('clubs').select('*'), 'kulüpler okunamadı');
      return rankClubs(data.map(toClub));
    },

    async studentVerification(meId) {
      const row = await maybeRow(
        db.from('student_verifications').select('*').eq('user_id', meId),
        'öğrenci doğrulaması okunamadı',
      );
      return row ? toStudentVerification(row) : null;
    },

    async verifyStudent(meId, email) {
      await requireUser(db, meId);
      const normalized = email.trim().toLowerCase();
      if (!isStudentEmail(normalized)) {
        throw new Error('Bu e-posta bir üniversite adresi gibi görünmüyor.');
      }
      const university = universityFromEmail(normalized) ?? 'Üniversite';
      const created = await oneRow(
        db
          .from('student_verifications')
          .upsert(
            {
              user_id: meId,
              email: normalized,
              university,
              token: '',
              // Demo: kod gönderimi simüle edilir, kayıt anında doğrulanmış sayılır.
              verified_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' },
          )
          .select('*'),
        'öğrenci doğrulaması kaydedilemedi',
      );
      return toStudentVerification(created);
    },

    async myClubs(meId) {
      const memberships = await rows(
        db.from('club_members').select('club_id').eq('user_id', meId),
        'üyelikler okunamadı',
      );
      const ids = memberships.map((row) => String(row.club_id));
      if (!ids.length) return [];
      const data = await rows(db.from('clubs').select('*').in('id', ids), 'kulüpler okunamadı');
      const enriched = await withMembership(data.map(toClub), meId);
      return enriched.sort((a, b) =>
        a.membership === b.membership ? 0 : a.membership === 'member' ? -1 : 1,
      );
    },
  };
}
