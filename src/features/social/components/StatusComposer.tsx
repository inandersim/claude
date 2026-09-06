import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AdventureImage, Avatar, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { MAX_STATUS_PHOTOS, type AdventureType, type HashtagSummary, type User } from '@/domain';

import { HashtagChip } from './HashtagChip';

/* ------------------------------------------------------------------ */
/* Fotoğraf seçici ızgarası                                             */
/* ------------------------------------------------------------------ */

interface PhotoGridProps {
  uris: string[];
  onChange: (uris: string[]) => void;
  adventureType: AdventureType;
  max?: number;
  onLimit?: () => void;
}

/** Çoklu fotoğraf seçici: küçük kareler + ekle kutusu; dokununca kaldır. */
export function PhotoPickerGrid({
  uris,
  onChange,
  adventureType,
  max = MAX_STATUS_PHOTOS,
  onLimit,
}: PhotoGridProps) {
  const { colors } = useTheme();
  const { t } = useT();
  const { width } = useWindowDimensions();
  const columns = width >= 600 ? 5 : 4;
  const gap = spacing.sm;
  const size =
    (Math.min(width, layout.maxContentWidth) - spacing.lg * 2 - gap * (columns - 1)) / columns;

  const pick = async () => {
    if (uris.length >= max) {
      onLimit?.();
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: max - uris.length,
    });
    if (result.canceled) return;
    const next = [...uris, ...result.assets.map((a) => a.uri)].slice(0, max);
    onChange(next);
  };

  const remove = (uri: string) => onChange(uris.filter((u) => u !== uri));

  return (
    <View style={[styles.grid, { gap }]}>
      {uris.map((uri, index) => (
        <Tappable
          key={`${uri}-${index}`}
          onPress={() => remove(uri)}
          haptic="selection"
          scaleTo={0.94}
          style={{ width: size, height: size }}
          accessibilityRole="button"
          accessibilityLabel={t('social.status.removePhoto')}
        >
          <AdventureImage uri={uri} adventureType={adventureType} style={styles.thumb}>
            <View style={styles.remove}>
              <Icon name="x" size={12} color="#FFFFFF" strokeWidth={3} />
            </View>
            {index === 0 ? (
              <View style={styles.coverTag}>
                <Text variant="label" weight="extrabold" color="#FFFFFF">
                  1
                </Text>
              </View>
            ) : null}
          </AdventureImage>
        </Tappable>
      ))}
      {uris.length < max ? (
        <Tappable
          onPress={pick}
          scaleTo={0.94}
          style={[
            styles.add,
            {
              width: size,
              height: size,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceMuted,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('social.status.addPhoto')}
        >
          <Icon name="image-plus" size={22} color={colors.primary} strokeWidth={1.8} />
          <Text variant="label" color="textMuted">
            {uris.length}/{max}
          </Text>
        </Tappable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Etiket önerileri                                                     */
/* ------------------------------------------------------------------ */

interface HashtagSuggestionsProps {
  tags: HashtagSummary[];
  query?: string;
  onPick: (tag: string) => void;
}

/** Trend etiketlerden (isteğe bağlı ön ek filtresiyle) yatay öneri şeridi. */
export function HashtagSuggestions({ tags, query = '', onPick }: HashtagSuggestionsProps) {
  const q = query.toLocaleLowerCase('tr-TR');
  const filtered = q ? tags.filter((h) => h.tag.startsWith(q)) : tags;
  if (filtered.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={styles.suggestionRow}
    >
      {filtered.slice(0, 10).map((h) => (
        <HashtagChip key={h.tag} tag={h.tag} count={h.count} onPress={onPick} size="sm" />
      ))}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Mention otomatik tamamlama                                           */
/* ------------------------------------------------------------------ */

interface MentionSuggestionsProps {
  users: User[];
  onPick: (user: User) => void;
}

/** `@` yazarken açılan kullanıcı listesi. */
export function MentionSuggestions({ users, onPick }: MentionSuggestionsProps) {
  const { colors } = useTheme();
  if (users.length === 0) return null;
  return (
    <View
      style={[
        styles.mentionList,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    >
      {users.slice(0, 5).map((user, index) => (
        <Tappable
          key={user.id}
          onPress={() => onPick(user)}
          haptic="selection"
          scaleTo={0.985}
          style={[
            styles.mentionRow,
            index > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`@${user.username}`}
        >
          <Avatar
            uri={user.avatarUrl}
            name={user.displayName}
            size={32}
            verified={user.isVerified}
          />
          <View style={{ flex: 1 }}>
            <Text variant="bodySm" weight="bold" numberOfLines={1}>
              {user.displayName}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              @{user.username}
            </Text>
          </View>
          <Icon name="at-sign" size={14} color={colors.textSubtle} />
        </Tappable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  thumb: { flex: 1, borderRadius: radius.md },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(8,14,12,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverTag: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(8,14,12,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  suggestionRow: { gap: spacing.sm, paddingVertical: 2 },
  mentionList: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
});
