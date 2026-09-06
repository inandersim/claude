import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button, Chip, Header, Icon, Input, Screen, Text } from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { radius, spacing, useTheme } from '@/core/theme';
import { filterSpecies, questionUrgency } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useCameraFrame } from '@/features/vision/hooks';
import { useAskWildlife, useOnlineHelpers, useSpecies } from '@/features/wildlife/hooks';

/** Soru formu: başlık, açıklama, fotoğraf, konum, acil anahtarı, tür tahmini. */
export default function AskWildlifeScreen() {
  const params = useLocalSearchParams<{
    speciesId?: string;
    title?: string;
    body?: string;
    imageUrl?: string;
  }>();
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const { coords, isFallback, request, status } = useLocation(me.coords);
  const { pickFromLibrary, isCapturing } = useCameraFrame();
  const ask = useAskWildlife();
  const online = useOnlineHelpers();
  const allSpecies = useSpecies({});

  const [title, setTitle] = useState(params.title ?? '');
  const [body, setBody] = useState(params.body ?? '');
  const [imageUrl, setImageUrl] = useState<string | null>(params.imageUrl || null);
  const [locationName, setLocationName] = useState(me.locationName);
  const [urgent, setUrgent] = useState(false);
  const [speciesId, setSpeciesId] = useState<string | null>(params.speciesId || null);
  const [speciesQuery, setSpeciesQuery] = useState('');
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});

  const picked = allSpecies.data?.find((s) => s.id === speciesId) ?? null;
  const options = useMemo(
    () => filterSpecies(allSpecies.data ?? [], { query: speciesQuery }).slice(0, 10),
    [allSpecies.data, speciesQuery],
  );
  const autoUrgency = questionUrgency(`${title} ${body}`, picked);

  const pickPhoto = async () => {
    const frame = await pickFromLibrary();
    if (frame) setImageUrl(frame.uri);
  };

  const submit = () => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = t('wildlife.ask.titleRequired');
    if (!body.trim()) next.body = t('wildlife.ask.bodyRequired');
    setErrors(next);
    if (next.title || next.body) return;
    ask.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        imageUrl,
        coords: isFallback ? null : coords,
        locationName: locationName.trim() || me.locationName,
        speciesGuessId: speciesId,
        urgent: urgent || autoUrgency === 'urgent',
      },
      {
        onSuccess: (q) => {
          toast(t('wildlife.ask.sent'), 'success');
          router.replace({ pathname: '/wildlife/question/[id]', params: { id: q.id } });
        },
        onError: () => toast(t('wildlife.ask.error'), 'error'),
      },
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={t('wildlife.ask.title')}
        subtitle={t('wildlife.ask.online', { count: online.data?.count ?? 0 })}
        showBack
        onBack={() => goBack(router, '/')}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="bodySm" color="textMuted">
          {t('wildlife.ask.subtitle')}
        </Text>

        <Input
          label={t('wildlife.ask.titleLabel')}
          placeholder={t('wildlife.ask.titlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          error={errors.title}
          maxLength={120}
        />
        <Input
          label={t('wildlife.ask.bodyLabel')}
          placeholder={t('wildlife.ask.bodyPlaceholder')}
          value={body}
          onChangeText={setBody}
          error={errors.body}
          multiline
          numberOfLines={4}
          style={styles.textArea}
          maxLength={2000}
        />

        <Text variant="label" color="textMuted">
          {t('wildlife.ask.photo').toUpperCase()}
        </Text>
        {imageUrl ? (
          <View>
            <Image
              source={{ uri: imageUrl }}
              style={[styles.image, { backgroundColor: colors.surfaceMuted }]}
              contentFit="cover"
              accessibilityLabel={t('wildlife.ask.photo')}
            />
            <Button
              label={t('wildlife.ask.removePhoto')}
              icon="trash"
              variant="ghost"
              size="sm"
              onPress={() => setImageUrl(null)}
              style={styles.selfStart}
            />
          </View>
        ) : (
          <Button
            label={t('wildlife.ask.addPhoto')}
            icon="image-plus"
            variant="secondary"
            onPress={() => void pickPhoto()}
            loading={isCapturing}
            style={styles.selfStart}
          />
        )}

        <Input
          label={t('wildlife.ask.location')}
          icon="map-pin"
          placeholder={t('wildlife.ask.locationPlaceholder')}
          value={locationName}
          onChangeText={setLocationName}
          right={
            <Button
              label={t('wildlife.ask.useMyLocation')}
              variant="ghost"
              size="sm"
              icon="locate"
              loading={status === 'requesting'}
              onPress={() => void request()}
            />
          }
        />
        {!isFallback ? (
          <Text variant="caption" color="textMuted">
            {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
          </Text>
        ) : null}

        <View
          style={[
            styles.urgentRow,
            {
              backgroundColor: colors.surface,
              borderColor: urgent ? colors.danger : colors.border,
            },
          ]}
        >
          <Icon name="siren" size={20} color={colors.danger} />
          <View style={styles.flex}>
            <Text variant="title">{t('wildlife.ask.urgent')}</Text>
            <Text variant="caption" color="textMuted">
              {t('wildlife.ask.urgentHint')}
            </Text>
            {autoUrgency === 'urgent' && !urgent ? (
              <Text variant="caption" color={colors.danger} weight="bold">
                {t('wildlife.ask.urgentAuto')}
              </Text>
            ) : null}
          </View>
          <Switch
            value={urgent || autoUrgency === 'urgent'}
            onValueChange={setUrgent}
            trackColor={{ true: colors.danger, false: colors.border }}
            accessibilityLabel={t('wildlife.ask.urgent')}
          />
        </View>

        <Text variant="label" color="textMuted">
          {t('wildlife.ask.guess').toUpperCase()}
        </Text>
        {picked ? (
          <View style={styles.pickedRow}>
            <Chip label={picked.commonName} selected icon="search" size="sm" />
            <Button
              label={t('wildlife.ask.noGuess')}
              variant="ghost"
              size="sm"
              icon="x"
              onPress={() => setSpeciesId(null)}
            />
          </View>
        ) : (
          <View
            style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Input
              icon="search"
              placeholder={t('wildlife.ask.guessSearch')}
              value={speciesQuery}
              onChangeText={setSpeciesQuery}
            />
            <View style={styles.chips}>
              {options.map((s) => (
                <Chip
                  key={s.id}
                  label={s.commonName}
                  size="sm"
                  onPress={() => setSpeciesId(s.id)}
                />
              ))}
            </View>
          </View>
        )}

        <Button
          label={t('wildlife.ask.submit')}
          icon="send"
          onPress={submit}
          loading={ask.isPending}
          disabled={ask.isPending}
          fullWidth
          size="lg"
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  flex: { flex: 1 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  selfStart: { alignSelf: 'flex-start' },
  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  pickedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  picker: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
