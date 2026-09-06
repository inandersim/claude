import { useRouter } from 'expo-router';
import { goBack } from '@/core/navigation';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Header, Icon, IconButton, Input, Screen, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import type { EmergencyContact } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useUpdateEmergencyContacts } from '@/features/firstaid/hooks';

/** Satır başına doğrulama hatası (ad / telefon). */
interface RowError {
  name?: string;
  phone?: string;
}

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const update = useUpdateEmergencyContacts();
  const [contacts, setContacts] = useState<EmergencyContact[]>(
    me.emergencyContacts.length ? me.emergencyContacts : [{ name: '', phone: '', userId: null }],
  );
  const [errors, setErrors] = useState<RowError[]>([]);

  const set = (i: number, patch: Partial<EmergencyContact>) => {
    setContacts((list) => list.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
    setErrors((prev) => (prev.length ? prev.map((e, idx) => (idx === i ? {} : e)) : prev));
  };
  const remove = (i: number) => {
    setContacts((list) => list.filter((_, idx) => idx !== i));
    setErrors((prev) => (prev.length ? prev.filter((_, idx) => idx !== i) : prev));
  };

  const save = () => {
    // Yarım dolu satır sessizce siliniyordu: ad ya da telefondan biri boşsa uyar
    const next: RowError[] = contacts.map((c) => {
      const name = c.name.trim();
      const phone = c.phone.trim();
      if (!name && !phone) return {};
      return {
        name: name ? undefined : t('auth.requiredField'),
        phone: phone ? undefined : t('auth.requiredField'),
      };
    });
    setErrors(next);
    if (next.some((e) => e.name || e.phone)) return;
    update.mutate(contacts, {
      onSuccess: () => {
        toast(t('firstAid.contactsSaved'), 'success');
        goBack(router);
      },
      onError: () => toast(t('common.error'), 'error'),
    });
  };

  return (
    <Screen edges={['top']}>
      <Header title={t('firstAid.contacts')} showBack />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.hint, { backgroundColor: colors.primarySoft }]}>
            <Icon name="siren" size={14} color={colors.primary} />
            <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
              {t('firstAid.sosHint')}
            </Text>
          </View>
          {contacts.map((c, i) => (
            <View
              key={i}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.cardHead}>
                <Text variant="label" color="textSubtle">
                  #{i + 1}
                </Text>
                <IconButton
                  icon="trash"
                  size={30}
                  iconSize={14}
                  variant="ghost"
                  color={colors.danger}
                  onPress={() => remove(i)}
                  accessibilityLabel={t('common.delete')}
                />
              </View>
              <Input
                label={t('firstAid.contactName')}
                icon="user"
                value={c.name}
                onChangeText={(v) => set(i, { name: v })}
                placeholder={t('firstAid.contactNamePlaceholder')}
                error={errors[i]?.name}
              />
              <Input
                label={t('firstAid.contactPhone')}
                icon="mail"
                value={c.phone}
                onChangeText={(v) => set(i, { phone: v })}
                keyboardType="phone-pad"
                placeholder={t('firstAid.contactPhonePlaceholder')}
                error={errors[i]?.phone}
              />
            </View>
          ))}
          {contacts.length < 5 ? (
            <Button
              label={t('firstAid.addContact')}
              icon="user-plus"
              variant="secondary"
              onPress={() => setContacts((l) => [...l, { name: '', phone: '', userId: null }])}
            />
          ) : null}
        </ScrollView>
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <Button
            label={t('common.save')}
            icon="check"
            size="lg"
            fullWidth
            loading={update.isPending}
            onPress={save}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
