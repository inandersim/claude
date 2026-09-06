import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, Header, Icon, Input, Screen, Tappable, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPE_META,
  ADVENTURE_TYPES,
  GROUP_KINDS,
  GROUP_PRIVACIES,
  type AdventureType,
  type GroupKind,
  type GroupPrivacy,
} from '@/domain';
import { useCreateGroup } from '@/features/groups/hooks';

export default function CreateGroupScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const create = useCreateGroup();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<GroupKind>('group');
  const [privacy, setPrivacy] = useState<GroupPrivacy>('public');
  const [description, setDescription] = useState('');
  const [types, setTypes] = useState<AdventureType[]>([]);
  const [city, setCity] = useState('');
  const [touched, setTouched] = useState(false);

  const nameError = touched && name.trim().length < 3 ? t('groups.create.nameError') : null;

  const submit = () => {
    setTouched(true);
    if (name.trim().length < 3) return;
    create.mutate(
      {
        name: name.trim(),
        kind,
        privacy,
        description: description.trim(),
        adventureTypes: types,
        city: city.trim() || null,
      },
      {
        onSuccess: (g) => {
          toast(t('groups.create.created'), 'success');
          router.replace({ pathname: '/groups/[id]', params: { id: g.id } });
        },
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  const toggleType = (type: AdventureType) =>
    setTypes((prev) => (prev.includes(type) ? prev.filter((x) => x !== type) : [...prev, type]));

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('groups.create.title')} showBack onBack={() => goBack(router, '/')} />
      <View style={styles.content}>
        <Input
          label={t('groups.create.name')}
          placeholder={t('groups.create.namePlaceholder')}
          value={name}
          onChangeText={setName}
          onBlur={() => setTouched(true)}
          error={nameError}
          maxLength={60}
        />

        <View style={styles.field}>
          <Text variant="caption" weight="bold" color="textMuted">
            {t('groups.create.kind')}
          </Text>
          <View style={styles.optionRow}>
            {GROUP_KINDS.map((k) => (
              <OptionCard
                key={k}
                selected={kind === k}
                icon={k === 'channel' ? 'radio' : 'users'}
                title={t(`groups.kind.${k}`)}
                hint={
                  k === 'channel'
                    ? t('groups.create.kindChannelHint')
                    : t('groups.create.kindGroupHint')
                }
                onPress={() => setKind(k)}
              />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text variant="caption" weight="bold" color="textMuted">
            {t('groups.create.privacy')}
          </Text>
          <View style={styles.optionRow}>
            {GROUP_PRIVACIES.map((p) => (
              <OptionCard
                key={p}
                selected={privacy === p}
                icon={p === 'private' ? 'lock' : 'globe'}
                title={t(`groups.privacy.${p}`)}
                hint={
                  p === 'private' ? t('groups.privacy.privateHint') : t('groups.privacy.publicHint')
                }
                onPress={() => setPrivacy(p)}
              />
            ))}
          </View>
        </View>

        <Input
          label={t('groups.create.description')}
          placeholder={t('groups.create.descriptionPlaceholder')}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          maxLength={400}
          style={{ minHeight: 96, textAlignVertical: 'top' }}
        />

        <View style={styles.field}>
          <Text variant="caption" weight="bold" color="textMuted">
            {t('groups.create.adventureTypes')}
          </Text>
          <View style={styles.chips}>
            {ADVENTURE_TYPES.map((type) => {
              const meta = ADVENTURE_TYPE_META[type];
              return (
                <Chip
                  key={type}
                  label={t(meta.labelKey)}
                  icon={meta.icon}
                  color={meta.color}
                  selected={types.includes(type)}
                  onPress={() => toggleType(type)}
                  size="sm"
                />
              );
            })}
          </View>
        </View>

        <Input
          label={t('groups.create.city')}
          placeholder={t('groups.create.cityPlaceholder')}
          icon="map-pin"
          value={city}
          onChangeText={setCity}
          maxLength={40}
        />

        <Button
          label={t('groups.create.submit')}
          icon="check"
          size="lg"
          fullWidth
          loading={create.isPending}
          onPress={submit}
        />
        <View style={{ height: spacing.xl }} />
        <Text variant="caption" color={colors.textSubtle} align="center">
          {privacy === 'private' ? t('groups.privacy.privateHint') : t('groups.privacy.publicHint')}
        </Text>
      </View>
    </Screen>
  );
}

function OptionCard({
  selected,
  icon,
  title,
  hint,
  onPress,
}: {
  selected: boolean;
  icon: 'radio' | 'users' | 'lock' | 'globe';
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Tappable
      onPress={onPress}
      haptic="selection"
      style={[
        styles.option,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${hint}`}
    >
      <Icon name={icon} size={20} color={selected ? colors.primary : colors.textMuted} />
      <Text variant="title" color={selected ? colors.primary : colors.text}>
        {title}
      </Text>
      <Text variant="caption" color="textMuted">
        {hint}
      </Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.huge, gap: spacing.lg },
  field: { gap: spacing.sm },
  optionRow: { flexDirection: 'row', gap: spacing.sm },
  option: { flex: 1, borderRadius: radius.lg, borderWidth: 1.5, padding: spacing.md, gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
