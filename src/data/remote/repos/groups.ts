import {
  applyVote,
  canManageGroup,
  canPost,
  encodeSystemMessage,
  extractMentions,
  filterGroups,
  generateInviteCode,
  groupMembershipOf,
  isPendingInvite,
  normalizeInviteCode,
  roleRank,
  sortByActivity,
  unreadCount,
  type Group,
  type GroupMember,
  type GroupMessage,
  type GroupMessageWithSender,
  type GroupRole,
  type GroupWithMembership,
  type ID,
  type PollOption,
  type User,
} from '@/domain';

import type { GroupRepository } from '../../repositories';
import { fetchUsers, medyaAdresi, notifyMany, pickUser, requireUser, type RemoteContext } from '../context';
import { fromGeoPoint, toGroup, toGroupMember, toGroupMessage } from '../mappers';
import { maybeRow, oneRow, rows } from '../postgrest';

const DEFAULT_PAGE = 50;

/**
 * Gruplar & kanallar uzak repository'si.
 *
 * Davet kuralı mock ile aynıdır: `invite` `group_members` tablosuna
 * `joined_at IS NULL` (mock'ta `joinedAt: ''`) bekleyen kayıt yazar; davet
 * edilen kişi `join` çağırınca kayıt tamamlanır.
 */
export function createGroupRepository(ctx: RemoteContext): GroupRepository {
  const { db } = ctx;

  const findGroup = async (id: ID): Promise<Group> => {
    const row = await maybeRow(db.from('groups').select('*').eq('id', id), 'grup okunamadı');
    if (!row) throw new Error(`Grup bulunamadı: ${id}`);
    return toGroup(row);
  };

  const membersOf = async (groupId: ID): Promise<GroupMember[]> => {
    const data = await rows(
      db.from('group_members').select('*').eq('group_id', groupId),
      'üyeler okunamadı',
    );
    return data.map(toGroupMember);
  };

  const requireMember = async (groupId: ID, userId: ID): Promise<GroupMember> => {
    const member = groupMembershipOf(await membersOf(groupId), groupId, userId);
    if (!member) throw new Error('Bu grubun üyesi değilsin.');
    return member;
  };

  const messagesOf = async (groupId: ID): Promise<GroupMessage[]> => {
    const data = await rows(
      db.from('group_messages').select('*').eq('group_id', groupId),
      'mesajlar okunamadı',
    );
    return data.map(toGroupMessage);
  };

  const withMembership = async (group: Group, meId: ID): Promise<GroupWithMembership> => {
    const [members, messages] = await Promise.all([membersOf(group.id), messagesOf(group.id)]);
    const member = groupMembershipOf(members, group.id, meId);
    const last = messages.reduce<GroupMessage | null>(
      (acc, m) => (!acc || new Date(m.createdAt) > new Date(acc.createdAt) ? m : acc),
      null,
    );
    return {
      ...group,
      membership: member?.role ?? null,
      unreadCount: unreadCount(messages, member),
      lastMessage: last,
    };
  };

  /** Birden çok grup için üyelik/okunmamış bilgisini tek turda toplar. */
  const withMembershipMany = async (groups: Group[], meId: ID): Promise<GroupWithMembership[]> => {
    if (!groups.length) return [];
    const ids = groups.map((g) => g.id);
    const [memberRows, messageRows] = await Promise.all([
      rows(db.from('group_members').select('*').in('group_id', ids), 'üyeler okunamadı'),
      rows(db.from('group_messages').select('*').in('group_id', ids), 'mesajlar okunamadı'),
    ]);
    const members = memberRows.map(toGroupMember);
    const messages = messageRows.map(toGroupMessage);
    return groups.map((group) => {
      const member = groupMembershipOf(members, group.id, meId);
      const mine = messages.filter((m) => m.groupId === group.id);
      const last = mine.reduce<GroupMessage | null>(
        (acc, m) => (!acc || new Date(m.createdAt) > new Date(acc.createdAt) ? m : acc),
        null,
      );
      return {
        ...group,
        membership: member?.role ?? null,
        unreadCount: unreadCount(mine, member),
        lastMessage: last,
      };
    });
  };

  const enrich = async (messages: GroupMessage[], meId: ID): Promise<GroupMessageWithSender[]> => {
    if (!messages.length) return [];
    const replyIds = messages.map((m) => m.replyToId).filter((id): id is ID => Boolean(id));
    const replyRows = replyIds.length
      ? await rows(db.from('group_messages').select('*').in('id', replyIds), 'yanıtlar okunamadı')
      : [];
    const replies = replyRows.map(toGroupMessage);
    const users = await fetchUsers(db, [
      ...messages.map((m) => m.senderId),
      ...replies.map((m) => m.senderId),
    ]);
    const pollIds = messages.filter((m) => m.poll).map((m) => m.id);
    const voteRows = pollIds.length
      ? await rows(
          db
            .from('poll_votes')
            .select('message_id, option_ids')
            .eq('user_id', meId)
            .in('message_id', pollIds),
          'oylar okunamadı',
        )
      : [];
    const votes = new Map(
      voteRows.map((row) => [String(row.message_id), (row.option_ids as string[]) ?? []]),
    );

    return messages.map((m) => {
      const reply = m.replyToId ? replies.find((r) => r.id === m.replyToId) : null;
      const replySender = reply ? users.get(reply.senderId) : null;
      const vote = m.poll ? (votes.get(m.id) ?? null) : null;
      return {
        ...m,
        sender: pickUser(users, m.senderId),
        myVote: vote && vote.length ? vote : null,
        replyTo: reply && replySender ? { ...reply, sender: replySender } : null,
      };
    });
  };

  const pushSystem = async (
    group: Group,
    actor: User,
    kind: 'joined' | 'left' | 'pinned' | 'created',
  ): Promise<void> => {
    // `touch_group_activity` tetikleyicisi last_message_at alanını günceller.
    await rows(
      db.from('group_messages').insert({
        group_id: group.id,
        sender_id: actor.id,
        type: 'system',
        text: encodeSystemMessage(kind, actor.displayName),
      }),
      'sistem mesajı yazılamadı',
    );
  };

  const completeJoin = async (group: Group, meId: ID): Promise<GroupWithMembership> => {
    const me = await requireUser(db, meId);
    const nowIso = new Date().toISOString();
    const pending = await maybeRow(
      db.from('group_members').select('*').eq('group_id', group.id).eq('user_id', meId),
      'davet okunamadı',
    );
    if (pending) {
      await rows(
        db
          .from('group_members')
          .update({ joined_at: nowIso, last_read_at: nowIso })
          .eq('group_id', group.id)
          .eq('user_id', meId),
        'katılım tamamlanamadı',
      );
      // Bekleyen davet üye sayısına dahil değildi; tetikleyici yalnızca INSERT sayar.
      const fresh = await oneRow(
        db.from('groups').select('member_count').eq('id', group.id),
        'grup okunamadı',
      );
      await rows(
        db
          .from('groups')
          .update({ member_count: Number(fresh.member_count ?? 0) + 1 })
          .eq('id', group.id),
        'üye sayısı güncellenemedi',
      );
    } else {
      await rows(
        db.from('group_members').insert({
          group_id: group.id,
          user_id: meId,
          role: 'member',
          joined_at: nowIso,
          last_read_at: nowIso,
        }),
        'gruba katılınamadı',
      );
    }
    await pushSystem(group, me, 'joined');
    return await withMembership(await findGroup(group.id), meId);
  };

  return {
    async list(meId, filter) {
      const data = await rows(db.from('groups').select('*'), 'gruplar okunamadı');
      const myMemberships = (
        await rows(db.from('group_members').select('*').eq('user_id', meId), 'üyelikler okunamadı')
      ).map(toGroupMember);
      const filtered = filterGroups(data.map(toGroup), filter, myMemberships);
      const enriched = await withMembershipMany(filtered, meId);
      const mine = sortByActivity(enriched.filter((g) => g.membership !== null));
      const others = enriched
        .filter((g) => g.membership === null)
        .sort((a, b) => b.memberCount - a.memberCount);
      return [...mine, ...others];
    },

    async getById(meId, groupId) {
      const row = await maybeRow(db.from('groups').select('*').eq('id', groupId), 'grup okunamadı');
      return row ? await withMembership(toGroup(row), meId) : null;
    },

    async create(meId, input) {
      const me = await requireUser(db, meId);
      const name = input.name.trim();
      if (name.length < 3) throw new Error('Grup adı en az 3 karakter olmalı.');
      const nowIso = new Date().toISOString();
      const created = await oneRow(
        db
          .from('groups')
          .insert({
            name,
            kind: input.kind,
            privacy: input.privacy,
            description: input.description.trim(),
            adventure_types: input.adventureTypes,
            city: input.city?.trim() || null,
            country_code: 'TR',
            owner_id: meId,
            member_count: 0,
            invite_code: generateInviteCode(`${name}:${nowIso}`),
          })
          .select('*'),
        'grup oluşturulamadı',
      );
      const group = toGroup(created);
      await rows(
        db.from('group_members').insert({
          group_id: group.id,
          user_id: meId,
          role: 'owner',
          joined_at: nowIso,
          last_read_at: nowIso,
        }),
        'sahip kaydı yazılamadı',
      );
      await pushSystem(group, me, 'created');
      return await withMembership(await findGroup(group.id), meId);
    },

    async join(meId, groupId) {
      const group = await findGroup(groupId);
      const members = await membersOf(groupId);
      if (groupMembershipOf(members, groupId, meId)) return await withMembership(group, meId);
      const invited = members.some((m) => m.userId === meId && isPendingInvite(m));
      if (group.privacy === 'private' && !invited) {
        throw new Error('Bu grup özel: katılmak için davet kodu gerekli.');
      }
      return await completeJoin(group, meId);
    },

    async joinByCode(meId, code) {
      const normalized = normalizeInviteCode(code);
      if (!normalized) throw new Error('Davet kodu boş olamaz.');
      const row = await maybeRow(
        db.from('groups').select('*').eq('invite_code', normalized),
        'grup okunamadı',
      );
      if (!row) throw new Error('Geçersiz davet kodu.');
      const group = toGroup(row);
      if (groupMembershipOf(await membersOf(group.id), group.id, meId)) {
        return await withMembership(group, meId);
      }
      return await completeJoin(group, meId);
    },

    async leave(meId, groupId) {
      const group = await findGroup(groupId);
      const me = await requireUser(db, meId);
      const member = await requireMember(groupId, meId);
      if (member.role === 'owner') {
        throw new Error('Grup sahibi ayrılamaz; önce sahipliği devret.');
      }
      await rows(
        db.from('group_members').delete().eq('group_id', groupId).eq('user_id', meId),
        'gruptan çıkılamadı',
      );
      await pushSystem(group, me, 'left');
    },

    async members(groupId) {
      await findGroup(groupId);
      const members = (await membersOf(groupId)).filter((m) => !isPendingInvite(m));
      const users = await fetchUsers(
        db,
        members.map((m) => m.userId),
      );
      return members
        .map((m) => {
          const user = users.get(m.userId);
          return user ? { ...user, role: m.role, joinedAt: m.joinedAt } : null;
        })
        .filter((x): x is User & { role: GroupRole; joinedAt: string } => x !== null)
        .sort(
          (a, b) =>
            roleRank(a.role) - roleRank(b.role) ||
            new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
        );
    },

    async setRole(meId, groupId, userId, role) {
      await findGroup(groupId);
      const me = await requireMember(groupId, meId);
      if (!canManageGroup(me.role)) throw new Error('Bu işlem için yönetici olmalısın.');
      const target = await requireMember(groupId, userId);
      if (target.role === 'owner') throw new Error('Grup sahibinin rolü değiştirilemez.');
      if (role === 'owner') {
        if (me.role !== 'owner') throw new Error('Sahipliği yalnızca sahip devredebilir.');
        await rows(
          db
            .from('group_members')
            .update({ role: 'admin' })
            .eq('group_id', groupId)
            .eq('user_id', meId),
          'rol güncellenemedi',
        );
        await rows(
          db.from('groups').update({ owner_id: userId }).eq('id', groupId),
          'grup sahibi güncellenemedi',
        );
      }
      await rows(
        db.from('group_members').update({ role }).eq('group_id', groupId).eq('user_id', userId),
        'rol güncellenemedi',
      );
    },

    async messages(meId, groupId, before = null, limit = DEFAULT_PAGE) {
      await findGroup(groupId);
      let query = db
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      if (before) query = query.lt('created_at', before);
      const data = await rows(query, 'mesajlar okunamadı', { limit });
      const page = data.map(toGroupMessage).reverse();
      return await enrich(page, meId);
    },

    async send(meId, groupId, input) {
      const group = await findGroup(groupId);
      const me = await requireUser(db, meId);
      const member = await requireMember(groupId, meId);
      if (!canPost(group, member.role)) {
        throw new Error('Bu kanalda yalnızca yöneticiler yazabilir.');
      }
      const text = input.text.trim();
      if (input.type === 'text' && !text) throw new Error('Mesaj boş olamaz.');
      if (input.type === 'image' && !input.imageUri) throw new Error('Görsel seçilmedi.');
      if (input.type === 'location' && !input.coords) throw new Error('Konum seçilmedi.');
      if (input.type === 'route' && !input.routeId) throw new Error('Rota seçilmedi.');
      if (input.type === 'system') throw new Error('Sistem mesajı gönderilemez.');

      let poll: GroupMessage['poll'] = null;
      if (input.type === 'poll') {
        const question = input.poll?.question.trim() ?? '';
        const options = (input.poll?.options ?? []).map((o) => o.trim()).filter(Boolean);
        if (!question) throw new Error('Anket sorusu boş olamaz.');
        if (options.length < 2 || options.length > 6) {
          throw new Error('Anket 2–6 seçenek içermeli.');
        }
        poll = {
          question,
          multi: Boolean(input.poll?.multi),
          options: options.map<PollOption>((o, i) => ({ id: `o${i + 1}`, text: o, votes: 0 })),
        };
      }
      const replyTo = input.replyToId
        ? await maybeRow(
            db
              .from('group_messages')
              .select('id')
              .eq('id', input.replyToId)
              .eq('group_id', groupId),
            'yanıt okunamadı',
          )
        : null;

      const groupImage =
        input.type === 'image'
          ? await medyaAdresi(ctx, 'post-media', meId, input.imageUri)
          : null;

      const created = await oneRow(
        db
          .from('group_messages')
          .insert({
            group_id: groupId,
            sender_id: meId,
            type: input.type,
            text,
            image_url: input.type === 'image' ? groupImage : null,
            coords: input.type === 'location' ? fromGeoPoint(input.coords ?? null) : null,
            route_id: input.type === 'route' ? (input.routeId ?? null) : null,
            poll,
            reply_to_id: replyTo ? String(replyTo.id) : null,
          })
          .select('*'),
        'mesaj gönderilemedi',
      );
      const message = toGroupMessage(created);
      await rows(
        db
          .from('group_members')
          .update({ last_read_at: message.createdAt })
          .eq('group_id', groupId)
          .eq('user_id', meId),
        'okundu bilgisi güncellenemedi',
      );

      // Kanalda tüm üyelere; grupta yalnızca @etiketlenenlere. Sessize alanlar hariç.
      const recipients = (await membersOf(groupId)).filter(
        (m) => m.userId !== meId && !isPendingInvite(m) && !m.muted,
      );
      const users = await fetchUsers(
        db,
        recipients.map((m) => m.userId),
      );
      const mentioned = new Set(extractMentions(text));
      const preview = text.slice(0, 80) || group.name;
      const targets = recipients
        .map((m) => users.get(m.userId))
        .filter((u): u is User => Boolean(u))
        .filter((user) => {
          const isMentioned =
            mentioned.has(user.username.toLocaleLowerCase('tr-TR')) ||
            mentioned.has(user.displayName.toLocaleLowerCase('tr-TR'));
          return group.kind === 'channel' || isMentioned;
        })
        .map((u) => u.id);
      await notifyMany(db, targets, {
        type: 'group_message',
        senderId: me.id,
        message: `${group.name}: ${preview}`,
        postId: null,
        matchId: null,
        targetId: groupId,
      });
      const [result] = await enrich([message], meId);
      if (!result) throw new Error('Mesaj oluşturulamadı.');
      return result;
    },

    async vote(meId, groupId, messageId, optionIds) {
      await findGroup(groupId);
      await requireMember(groupId, meId);
      const row = await maybeRow(
        db.from('group_messages').select('*').eq('id', messageId).eq('group_id', groupId),
        'mesaj okunamadı',
      );
      const message = row ? toGroupMessage(row) : null;
      if (!message?.poll) throw new Error('Anket bulunamadı.');
      const existing = await maybeRow(
        db.from('poll_votes').select('option_ids').eq('user_id', meId).eq('message_id', messageId),
        'oy okunamadı',
      );
      const previous = existing ? ((existing.option_ids as string[]) ?? null) : null;
      const result = applyVote(message.poll, previous, optionIds);
      await rows(
        db.from('group_messages').update({ poll: result.poll }).eq('id', messageId),
        'anket güncellenemedi',
      );
      if (result.vote) {
        await rows(
          db
            .from('poll_votes')
            .upsert(
              { message_id: messageId, user_id: meId, option_ids: result.vote },
              { onConflict: 'message_id,user_id' },
            ),
          'oy yazılamadı',
        );
      } else {
        await rows(
          db.from('poll_votes').delete().eq('message_id', messageId).eq('user_id', meId),
          'oy geri alınamadı',
        );
      }
      const fresh = await oneRow(
        db.from('group_messages').select('*').eq('id', messageId),
        'mesaj okunamadı',
      );
      const [enriched] = await enrich([toGroupMessage(fresh)], meId);
      if (!enriched) throw new Error('Anket bulunamadı.');
      return enriched;
    },

    async pin(meId, groupId, messageId) {
      const group = await findGroup(groupId);
      const me = await requireUser(db, meId);
      const member = await requireMember(groupId, meId);
      if (!canManageGroup(member.role)) throw new Error('Sabitlemek için yönetici olmalısın.');
      if (messageId) {
        const exists = await maybeRow(
          db.from('group_messages').select('id').eq('id', messageId).eq('group_id', groupId),
          'mesaj okunamadı',
        );
        if (!exists) throw new Error('Mesaj bulunamadı.');
        await rows(
          db.from('groups').update({ pinned_message_id: messageId }).eq('id', groupId),
          'mesaj sabitlenemedi',
        );
        await pushSystem(group, me, 'pinned');
      } else {
        await rows(
          db.from('groups').update({ pinned_message_id: null }).eq('id', groupId),
          'sabit kaldırılamadı',
        );
      }
      return await findGroup(groupId);
    },

    async markRead(meId, groupId) {
      const members = await membersOf(groupId);
      if (!groupMembershipOf(members, groupId, meId)) return;
      await rows(
        db
          .from('group_members')
          .update({ last_read_at: new Date().toISOString() })
          .eq('group_id', groupId)
          .eq('user_id', meId),
        'okundu bilgisi güncellenemedi',
      );
    },

    async toggleMute(meId, groupId) {
      const member = await requireMember(groupId, meId);
      const muted = !member.muted;
      await rows(
        db.from('group_members').update({ muted }).eq('group_id', groupId).eq('user_id', meId),
        'sessize alma güncellenemedi',
      );
      return muted;
    },

    async invite(meId, groupId, userId) {
      const group = await findGroup(groupId);
      const me = await requireUser(db, meId);
      await requireMember(groupId, meId);
      await requireUser(db, userId);
      if (userId === meId) throw new Error('Kendini davet edemezsin.');
      const members = await membersOf(groupId);
      if (groupMembershipOf(members, groupId, userId)) {
        throw new Error('Bu kullanıcı zaten üye.');
      }
      const pending = members.some((m) => m.userId === userId && isPendingInvite(m));
      if (!pending) {
        await rows(
          db.from('group_members').insert({
            group_id: groupId,
            user_id: userId,
            role: 'member',
            joined_at: null,
            invited_by: meId,
          }),
          'davet gönderilemedi',
        );
        // Bekleyen davet üye sayısına dahil edilmez; tetikleyicinin artışını geri al.
        const fresh = await oneRow(
          db.from('groups').select('member_count').eq('id', groupId),
          'grup okunamadı',
        );
        await rows(
          db
            .from('groups')
            .update({ member_count: Math.max(0, Number(fresh.member_count ?? 0) - 1) })
            .eq('id', groupId),
          'üye sayısı güncellenemedi',
        );
      }
      await notifyMany(db, [userId], {
        type: 'group_invite',
        senderId: me.id,
        message: `${group.name} · ${group.inviteCode}`,
        postId: null,
        matchId: null,
        targetId: groupId,
      });
    },
  };
}
