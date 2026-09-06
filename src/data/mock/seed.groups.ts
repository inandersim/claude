import type { Group, GroupMember, GroupMessage } from '@/domain';

export const seedGroups: Group[] = [];
export const seedGroupMembers: GroupMember[] = [];
export const seedGroupMessages: GroupMessage[] = [];
export const seedPollVotes: { userId: string; messageId: string; optionIds: string[] }[] = [];
