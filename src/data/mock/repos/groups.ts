import { generateId } from '@/core/utils/format';
import type { GroupRepository } from '@/data/repositories';
import {
  applyVote,
  canManageGroup,
  canPost,
  encodeSystemMessage,
  extractMentions,
  filterGroups,
  generateInviteCode,
  isPendingInvite,
  groupMembershipOf,
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

import type { MockContext } from '../context';
import type { Tables } from '../database';

const DEFAULT_PAGE = 50;

/**
 * groups modülü mock repository fabrikası.
 *
 * Davet kuralı: `invite` özel/açık fark etmeksizin `t.groupMembers`'a
 * `role: 'member', joinedAt: ''` biçiminde **bekleyen** bir kayıt yazar; davet edilen
 * kişi `join` çağırınca kayıt tamamlanır (özel grup için davet zorunludur, aksi hâlde
 * "davet kodu gerekli" hatası). `joinByCode` doğrudan katılır.
 */
export function createGroupRepository(ctx: MockContext): GroupRepository {
  const { db, wait, requireUser, pushNotification } = ctx;

  const findGroup = (t: Tables, id: ID): Group => {
    const g = t.groups.find((x) => x.id === id);
    if (!g) throw new Error(`Grup bulunamadı: ${id}`);
    return g;
  };

  const requireMember = (t: Tables, groupId: ID, userId: ID): GroupMember => {
    const m = groupMembershipOf(t.groupMembers, groupId, userId);
    if (!m) throw new Error('Bu grubun üyesi değilsin.');
    return m;
  };

  const messagesOf = (t: Tables, groupId: ID) =>
    t.groupMessages.filter((m) => m.groupId === groupId);

  const lastMessageOf = (t: Tables, groupId: ID): GroupMessage | null =>
    messagesOf(t, groupId).reduce<GroupMessage | null>(
      (acc, m) => (!acc || new Date(m.createdAt) > new Date(acc.createdAt) ? m : acc),
      null,
    );

  const withMembership = (t: Tables, group: Group, meId: ID): GroupWithMembership => {
    const member = groupMembershipOf(t.groupMembers, group.id, meId);
    return {
      ...group,
      membership: member?.role ?? null,
      unreadCount: unreadCount(messagesOf(t, group.id), member),
      lastMessage: lastMessageOf(t, group.id),
    };
  };

  const enrich = (t: Tables, m: GroupMessage, meId: ID): GroupMessageWithSender => {
    const sender = requireUser(t.users, m.senderId);
    const reply = m.replyToId ? t.groupMessages.find((x) => x.id === m.replyToId) : null;
    const replySender = reply ? t.users.find((u) => u.id === reply.senderId) : null;
    const vote = m.poll
      ? (t.pollVotes.find((v) => v.userId === meId && v.messageId === m.id)?.optionIds ?? null)
      : null;
    return {
      ...m,
      sender,
      myVote: vote && vote.length ? vote : null,
      replyTo: reply && replySender ? { ...reply, sender: replySender } : null,
    };
  };

  const pushSystem = (
    t: Tables,
    group: Group,
    actor: User,
    kind: 'joined' | 'left' | 'pinned' | 'created',
  ) => {
    const message: GroupMessage = {
      id: generateId('gm'),
      groupId: group.id,
      senderId: actor.id,
      type: 'system',
      text: encodeSystemMessage(kind, actor.displayName),
      imageUrl: null,
      coords: null,
      routeId: null,
      poll: null,
      replyToId: null,
      createdAt: new Date().toISOString(),
      editedAt: null,
    };
    t.groupMessages.push(message);
    group.lastMessageAt = message.createdAt;
    return message;
  };

  const completeJoin = (t: Tables, group: Group, meId: ID): GroupWithMembership => {
    const me = requireUser(t.users, meId);
    const pending = t.groupMembers.find(
      (m) => m.groupId === group.id && m.userId === meId && isPendingInvite(m),
    );
    const nowIso = new Date().toISOString();
    if (pending) {
      pending.joinedAt = nowIso;
      pending.lastReadAt = nowIso;
    } else {
      t.groupMembers.push({
        groupId: group.id,
        userId: meId,
        role: 'member',
        joinedAt: nowIso,
        muted: false,
        lastReadAt: nowIso,
      });
    }
    group.memberCount += 1;
    pushSystem(t, group, me, 'joined');
    db.markDirty();
    return withMembership(t, group, meId);
  };

  return {
    async list(meId, filter) {
      await wait();
      const t = await db.load();
      const myMemberships = t.groupMembers.filter((m) => m.userId === meId);
      const filtered = filterGroups(t.groups, filter, myMemberships).map((g) =>
        withMembership(t, g, meId),
      );
      const mine = sortByActivity(filtered.filter((g) => g.membership !== null));
      const others = filtered
        .filter((g) => g.membership === null)
        .sort((a, b) => b.memberCount - a.memberCount);
      return [...mine, ...others];
    },

    async getById(meId, groupId) {
      await wait();
      const t = await db.load();
      const g = t.groups.find((x) => x.id === groupId);
      return g ? withMembership(t, g, meId) : null;
    },

    async create(meId, input) {
      await wait();
      const t = await db.load();
      const me = requireUser(t.users, meId);
      const name = input.name.trim();
      if (name.length < 3) throw new Error('Grup adı en az 3 karakter olmalı.');
      const id = generateId('g');
      const nowIso = new Date().toISOString();
      const group: Group = {
        id,
        name,
        kind: input.kind,
        privacy: input.privacy,
        description: input.description.trim(),
        avatarUrl: null,
        adventureTypes: input.adventureTypes,
        city: input.city?.trim() || null,
        countryCode: 'TR',
        ownerId: meId,
        memberCount: 1,
        inviteCode: generateInviteCode(`${id}:${nowIso}`),
        pinnedMessageId: null,
        clubId: null,
        createdAt: nowIso,
        lastMessageAt: null,
      };
      t.groups.unshift(group);
      t.groupMembers.push({
        groupId: id,
        userId: meId,
        role: 'owner',
        joinedAt: nowIso,
        muted: false,
        lastReadAt: nowIso,
      });
      pushSystem(t, group, me, 'created');
      db.markDirty();
      return withMembership(t, group, meId);
    },

    async join(meId, groupId) {
      await wait();
      const t = await db.load();
      const group = findGroup(t, groupId);
      if (groupMembershipOf(t.groupMembers, groupId, meId)) return withMembership(t, group, meId);
      const invited = t.groupMembers.some(
        (m) => m.groupId === groupId && m.userId === meId && isPendingInvite(m),
      );
      if (group.privacy === 'private' && !invited) {
        throw new Error('Bu grup özel: katılmak için davet kodu gerekli.');
      }
      return completeJoin(t, group, meId);
    },

    async joinByCode(meId, code) {
      await wait();
      const t = await db.load();
      const normalized = normalizeInviteCode(code);
      if (!normalized) throw new Error('Davet kodu boş olamaz.');
      const group = t.groups.find((g) => g.inviteCode === normalized);
      if (!group) throw new Error('Geçersiz davet kodu.');
      if (groupMembershipOf(t.groupMembers, group.id, meId)) return withMembership(t, group, meId);
      return completeJoin(t, group, meId);
    },

    async leave(meId, groupId) {
      await wait();
      const t = await db.load();
      const group = findGroup(t, groupId);
      const me = requireUser(t.users, meId);
      const member = requireMember(t, groupId, meId);
      if (member.role === 'owner') {
        throw new Error('Grup sahibi ayrılamaz; önce sahipliği devret.');
      }
      t.groupMembers = t.groupMembers.filter((m) => !(m.groupId === groupId && m.userId === meId));
      group.memberCount = Math.max(0, group.memberCount - 1);
      pushSystem(t, group, me, 'left');
      db.markDirty();
    },

    async members(groupId) {
      await wait();
      const t = await db.load();
      findGroup(t, groupId);
      return t.groupMembers
        .filter((m) => m.groupId === groupId && !isPendingInvite(m))
        .map((m) => {
          const user = t.users.find((u) => u.id === m.userId);
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
      await wait();
      const t = await db.load();
      const group = findGroup(t, groupId);
      const me = requireMember(t, groupId, meId);
      if (!canManageGroup(me.role)) throw new Error('Bu işlem için yönetici olmalısın.');
      const target = requireMember(t, groupId, userId);
      if (target.role === 'owner') throw new Error('Grup sahibinin rolü değiştirilemez.');
      if (role === 'owner') {
        if (me.role !== 'owner') throw new Error('Sahipliği yalnızca sahip devredebilir.');
        me.role = 'admin';
        group.ownerId = userId;
      }
      target.role = role;
      db.markDirty();
    },

    async messages(meId, groupId, before = null, limit = DEFAULT_PAGE) {
      await wait();
      const t = await db.load();
      findGroup(t, groupId);
      const cutoff = before ? new Date(before).getTime() : Infinity;
      const page = messagesOf(t, groupId)
        .filter((m) => new Date(m.createdAt).getTime() < cutoff)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit)
        .reverse();
      return page.map((m) => enrich(t, m, meId));
    },

    async send(meId, groupId, input) {
      await wait();
      const t = await db.load();
      const group = findGroup(t, groupId);
      const me = requireUser(t.users, meId);
      const member = requireMember(t, groupId, meId);
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
        ? t.groupMessages.find((m) => m.id === input.replyToId && m.groupId === groupId)
        : null;

      const nowIso = new Date().toISOString();
      const message: GroupMessage = {
        id: generateId('gm'),
        groupId,
        senderId: meId,
        type: input.type,
        text,
        imageUrl: input.type === 'image' ? (input.imageUri ?? null) : null,
        coords: input.type === 'location' ? (input.coords ?? null) : null,
        routeId: input.type === 'route' ? (input.routeId ?? null) : null,
        poll,
        replyToId: replyTo?.id ?? null,
        createdAt: nowIso,
        editedAt: null,
      };
      t.groupMessages.push(message);
      group.lastMessageAt = nowIso;
      member.lastReadAt = nowIso;
      db.markDirty();

      // Bildirim: kanalda tüm üyelere; grupta yalnızca @etiketlenenlere. Sessize alanlar hariç.
      const recipients = t.groupMembers.filter(
        (m) => m.groupId === groupId && m.userId !== meId && !isPendingInvite(m) && !m.muted,
      );
      const mentioned = new Set(extractMentions(text));
      const preview = text.slice(0, 80) || group.name;
      for (const r of recipients) {
        const user = t.users.find((u) => u.id === r.userId);
        if (!user) continue;
        const isMentioned =
          mentioned.has(user.username.toLocaleLowerCase('tr-TR')) ||
          mentioned.has(user.displayName.toLocaleLowerCase('tr-TR'));
        if (group.kind !== 'channel' && !isMentioned) continue;
        await pushNotification({
          type: 'group_message',
          senderId: me.id,
          receiverId: user.id,
          message: `${group.name}: ${preview}`,
          postId: null,
          matchId: null,
          targetId: groupId,
        });
      }
      return enrich(t, message, meId);
    },

    async vote(meId, groupId, messageId, optionIds) {
      await wait();
      const t = await db.load();
      findGroup(t, groupId);
      requireMember(t, groupId, meId);
      const message = t.groupMessages.find((m) => m.id === messageId && m.groupId === groupId);
      if (!message || !message.poll) throw new Error('Anket bulunamadı.');
      const existing = t.pollVotes.find((v) => v.userId === meId && v.messageId === messageId);
      const result = applyVote(message.poll, existing?.optionIds ?? null, optionIds);
      message.poll = result.poll;
      t.pollVotes = t.pollVotes.filter((v) => !(v.userId === meId && v.messageId === messageId));
      if (result.vote) t.pollVotes.push({ userId: meId, messageId, optionIds: result.vote });
      db.markDirty();
      return enrich(t, message, meId);
    },

    async pin(meId, groupId, messageId) {
      await wait();
      const t = await db.load();
      const group = findGroup(t, groupId);
      const me = requireUser(t.users, meId);
      const member = requireMember(t, groupId, meId);
      if (!canManageGroup(member.role)) throw new Error('Sabitlemek için yönetici olmalısın.');
      if (messageId) {
        const exists = t.groupMessages.some((m) => m.id === messageId && m.groupId === groupId);
        if (!exists) throw new Error('Mesaj bulunamadı.');
        group.pinnedMessageId = messageId;
        pushSystem(t, group, me, 'pinned');
      } else {
        group.pinnedMessageId = null;
      }
      db.markDirty();
      return group;
    },

    async markRead(meId, groupId) {
      const t = await db.load();
      const member = groupMembershipOf(t.groupMembers, groupId, meId);
      if (!member) return;
      member.lastReadAt = new Date().toISOString();
      db.markDirty();
    },

    async toggleMute(meId, groupId) {
      await wait();
      const t = await db.load();
      const member = requireMember(t, groupId, meId);
      member.muted = !member.muted;
      db.markDirty();
      return member.muted;
    },

    async invite(meId, groupId, userId) {
      await wait();
      const t = await db.load();
      const group = findGroup(t, groupId);
      const me = requireUser(t.users, meId);
      requireMember(t, groupId, meId);
      requireUser(t.users, userId);
      if (userId === meId) throw new Error('Kendini davet edemezsin.');
      if (groupMembershipOf(t.groupMembers, groupId, userId)) {
        throw new Error('Bu kullanıcı zaten üye.');
      }
      const pending = t.groupMembers.some(
        (m) => m.groupId === groupId && m.userId === userId && isPendingInvite(m),
      );
      if (!pending) {
        t.groupMembers.push({
          groupId,
          userId,
          role: 'member',
          joinedAt: '',
          muted: false,
          lastReadAt: null,
        });
        db.markDirty();
      }
      await pushNotification({
        type: 'group_invite',
        senderId: me.id,
        receiverId: userId,
        message: `${group.name} · ${group.inviteCode}`,
        postId: null,
        matchId: null,
        targetId: groupId,
      });
    },
  };
}
