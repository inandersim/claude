import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button, Chip, Header, Input, Screen, SegmentedControl, Text } from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { spacing, useTheme } from '@/core/theme';
import {
  CONSULT_URGENCIES,
  detectCountry,
  DOCTOR_SPECIALTIES,
  localTriage,
  specialtyFor,
  urgencyMeta,
  type ConsultUrgency,
  type DoctorSpecialty,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { DisclaimerBanner } from '@/features/telemed/components/DisclaimerBanner';
import { SpecialtyChips } from '@/features/telemed/components/SpecialtyChips';
import { TriageCard } from '@/features/telemed/components/TriageCard';
import { useRequestConsult, useTriage } from '@/features/telemed/hooks';

const MIN_COMPLAINT = 8;
const TRIAGE_DEBOUNCE_MS = 600;
type Channel = 'chat' | 'video';

export default function RequestConsultScreen() {
  const params = useLocalSearchParams<{
    speciesId?: string;
    firstAidSlug?: string;
    complaint?: string;
    specialty?: string;
  }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const { coords, request: requestLocation, isFallback } = useLocation(me.coords);

  const [complaint, setComplaint] = useState(params.complaint ?? '');
  const [urgency, setUrgency] = useState<ConsultUrgency | null>(null);
  const [specialty, setSpecialty] = useState<DoctorSpecialty | null>(
    (DOCTOR_SPECIALTIES as readonly string[]).includes(params.specialty ?? '')
      ? (params.specialty as DoctorSpecialty)
      : null,
  );
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [shareLocation, setShareLocation] = useState(true);
  const [channel, setChannel] = useState<Channel>('chat');

  const speciesId = params.speciesId || null;
  const triage = useTriage();
  const request = useRequestConsult();

  const ready = complaint.trim().length >= MIN_COMPLAINT;

  // Yazdıkça (debounce) ön triyaj; gateway varsa uzaktan, yoksa yerel
  const triageMutate = triage.mutate;
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(
      () => triageMutate({ complaint: complaint.trim(), speciesId, locale }),
      TRIAGE_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [complaint, ready, speciesId, locale, triageMutate]);

  // Yerel triyaj anında hesaplanır (tür ve adım başlığı için); uzak sonuç gelirse onu gösteririz.
  const local = useMemo(
    () => (ready ? localTriage(complaint, locale, null) : null),
    [complaint, locale, ready],
  );
  // Ağ geçidi yoksa repo yerel sonucu döner; "yapay zekâ destekli" demek yanıltıcı olur
  // Sonucun kaynağı repo tarafından bildirilir; ağ geçidi tanımlı olup istek
  // düşerse yerele inilir ve etiket doğru kalır.
  const remote = triage.data?.source === 'remote' ? triage.data : null;
  const shown = remote ?? local;
  const suggestedUrgency = shown?.urgency ?? null;
  const effectiveUrgency: ConsultUrgency = urgency ?? suggestedUrgency ?? 'medium';
  const suggestedSpecialty = local ? specialtyFor(local) : null;
  const countryCode = detectCountry(coords);

  const pickImage = async () => {
    if (Platform.OS === 'web') {
      toast(t('telemed.request.photoAdded'), 'info');
      setImageUri('https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled) return;
    setImageUri(result.assets[0]?.uri ?? null);
  };

  const submit = () => {
    if (!ready) return;
    request.mutate(
      {
        complaint: complaint.trim(),
        urgency: effectiveUrgency,
        specialty,
        firstAidSlug: params.firstAidSlug || shown?.firstAidSlug || null,
        speciesId,
        coords: shareLocation ? coords : null,
        channel,
        imageUri,
      },
      {
        onSuccess: (c) =>
          router.replace({ pathname: '/telemed/consult/[id]', params: { id: c.id } }),
        onError: (e) => toast(e instanceof Error ? e.message : t('telemed.request.error'), 'error'),
      },
    );
  };

  const channelSegments: { value: Channel; label: string }[] = [
    { value: 'chat', label: t('telemed.request.chat') },
    { value: 'video', label: t('telemed.request.video') },
  ];

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        showBack
        onBack={() => goBack(router, '/explore')}
        title={t('telemed.request.title')}
        subtitle={t('telemed.request.subtitle')}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <DisclaimerBanner compact />

        <Input
          label={t('telemed.request.complaint')}
          placeholder={t('telemed.request.complaintPlaceholder')}
          hint={
            ready
              ? t('telemed.request.complaintHint')
              : t('telemed.request.minChars', { count: MIN_COMPLAINT })
          }
          value={complaint}
          onChangeText={setComplaint}
          multiline
          numberOfLines={4}
          maxLength={2000}
          style={{ minHeight: 96, textAlignVertical: 'top' }}
          accessibilityLabel={t('telemed.request.complaint')}
        />

        <View style={styles.field}>
          <Text variant="label" color="textMuted">
            {t('telemed.request.urgency')}
            {suggestedUrgency
              ? ` · ${t('telemed.request.suggested')}: ${t(urgencyMeta(suggestedUrgency).labelKey)}`
              : ''}
          </Text>
          <View style={styles.wrap}>
            {CONSULT_URGENCIES.map((u) => {
              const meta = urgencyMeta(u);
              return (
                <Chip
                  key={u}
                  label={t(meta.labelKey)}
                  icon={meta.icon}
                  color={colors[meta.color]}
                  selected={effectiveUrgency === u}
                  onPress={() => setUrgency(u)}
                  size="sm"
                />
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text variant="label" color="textMuted">
            {t('telemed.request.specialty')}
            {suggestedSpecialty && !specialty
              ? ` · ${t('telemed.request.autoSpecialty')}: ${t(`telemed.specialty.${suggestedSpecialty}`)}`
              : ''}
          </Text>
          <View style={styles.chipsBleed}>
            <SpecialtyChips
              value={specialty}
              onChange={setSpecialty}
              allLabel={t('telemed.request.autoSpecialty')}
            />
          </View>
        </View>

        <View style={styles.rowField}>
          <View style={{ flex: 1 }}>
            <Text variant="label" color="textMuted">
              {t('telemed.request.photo')}
            </Text>
            <Text variant="caption" color={imageUri ? colors.success : colors.textSubtle}>
              {imageUri ? t('telemed.request.photoAdded') : '—'}
            </Text>
          </View>
          <Button
            label={imageUri ? t('telemed.request.removePhoto') : t('telemed.request.addPhoto')}
            icon={imageUri ? 'x' : 'camera'}
            variant="secondary"
            size="sm"
            onPress={imageUri ? () => setImageUri(null) : pickImage}
          />
        </View>

        <View style={styles.rowField}>
          <View style={{ flex: 1 }}>
            <Text variant="label" color="textMuted">
              {t('telemed.request.location')}
            </Text>
            <Text variant="caption" color="textSubtle">
              {shareLocation
                ? t('telemed.request.locationShared')
                : t('telemed.request.locationOff')}
              {shareLocation && isFallback ? ' · ' : ''}
              {shareLocation && isFallback ? (
                <Text variant="caption" color={colors.primary} onPress={() => requestLocation()}>
                  {t('telemed.request.shareLocation')}
                </Text>
              ) : null}
            </Text>
          </View>
          <Switch
            value={shareLocation}
            onValueChange={setShareLocation}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={t('telemed.request.shareLocation')}
          />
        </View>

        <View style={styles.field}>
          <Text variant="label" color="textMuted">
            {t('telemed.request.channel')}
          </Text>
          <SegmentedControl segments={channelSegments} value={channel} onChange={setChannel} />
        </View>

        {shown ? (
          <View style={styles.field}>
            <Text variant="label" color="textMuted">
              {t('telemed.request.triageTitle')} · {t('telemed.request.triageHint')}
            </Text>
            <TriageCard
              triage={{ ...shown, kind: local?.kind }}
              countryCode={countryCode}
              source={remote ? 'remote' : 'local'}
            />
          </View>
        ) : null}

        <Button
          label={request.isPending ? t('telemed.request.connecting') : t('telemed.request.connect')}
          icon="heart-pulse"
          size="lg"
          fullWidth
          disabled={!ready}
          loading={request.isPending}
          onPress={submit}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  field: { gap: spacing.sm },
  rowField: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chipsBleed: { marginHorizontal: -spacing.lg },
});
