import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  DENIZ_SEVIYESI_HPA,
  irtifaDegerlendir,
  solunanOksijenMmHg,
  type IrtifaGirdisi,
  type IrtifaRiski,
} from '@/domain/altitude';

/** Risk düzeyi → tema rengi anahtarı. Ton sırası şiddetle artar. */
const RISK_TONU: Record<IrtifaRiski, 'success' | 'info' | 'warning' | 'danger'> = {
  normal: 'success',
  izle: 'info',
  dinlen: 'warning',
  in: 'danger',
  acil: 'danger',
};

/** Kart, değerlendirme girdisinin tamamını olduğu gibi alır. */
export type AltitudeStatusCardProps = IrtifaGirdisi;

/**
 * İrtifa durumu kartı: bulunduğun yükseklikte atmosferin ne yaptığı ve buna
 * göre ne yapman gerektiği.
 *
 * Tavsiyeler aciliyet sırasına göre gelir (`irtifaDegerlendir`); ekran sırayı
 * değiştirmez. Kan basıncı **ölçülmüş** değer olarak gelir; kart tahmin
 * göstermez ve nedenini kullanıcıya açıkça yazar.
 */
export function AltitudeStatusCard(props: AltitudeStatusCardProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const sonuc = useMemo(() => irtifaDegerlendir(props), [props]);
  const ton = RISK_TONU[sonuc.risk];
  const renk = colors[ton];

  const oksijenYuzde = Math.round(
    (solunanOksijenMmHg(props.irtifaM) / solunanOksijenMmHg(0)) * 100,
  );
  const basincYuzde = Math.round((sonuc.basincHPa / DENIZ_SEVIYESI_HPA) * 100);

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.head}>
        <Icon name="mountain-snow" size={20} color={renk} strokeWidth={2.4} />
        <View style={{ flex: 1 }}>
          <Text variant="label" color="textSubtle">
            {t('altitude.title')}
          </Text>
          <Text variant="h3" color={ton}>
            {t(`altitude.risk.${sonuc.risk}` as 'altitude.risk.normal')}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric
          label={t('altitude.metric.pressure')}
          value={`${sonuc.basincHPa} hPa`}
          hint={t('altitude.metric.vsSeaLevel', { percent: basincYuzde })}
        />
        <Metric
          label={t('altitude.metric.inspiredO2')}
          value={`${sonuc.solunanOksijenMmHg} mmHg`}
          hint={t('altitude.metric.vsSeaLevel', { percent: oksijenYuzde })}
        />
        <Metric
          label={t('altitude.metric.expectedSpo2')}
          value={`%${sonuc.spo2Beklenen.alt}–${sonuc.spo2Beklenen.ust}`}
        />
        {sonuc.nabizYukselmeYuzde !== null ? (
          <Metric
            label={t('altitude.metric.hrRise')}
            value={`%${sonuc.nabizYukselmeYuzde}`}
          />
        ) : null}
      </View>

      {sonuc.nedenler.length ? (
        <View style={styles.reasons}>
          {sonuc.nedenler.map((neden) => (
            <Text key={neden} variant="bodySm" color="textSubtle">
              • {t(`altitude.reason.${neden}` as 'altitude.reason.ataksi')}
            </Text>
          ))}
        </View>
      ) : null}

      {sonuc.tavsiyeler.length ? (
        <View style={styles.advice}>
          {sonuc.tavsiyeler.map((kod, i) => (
            <Text
              key={kod}
              variant="bodySm"
              // İlk iki tavsiye aciliyet sırasının tepesi; vurgulanır.
              color={i < 2 && (sonuc.risk === 'acil' || sonuc.risk === 'in') ? ton : 'text'}
            >
              {i + 1}. {t(`altitude.advice.${kod}` as 'altitude.advice.hemenIn')}
            </Text>
          ))}
        </View>
      ) : null}

      {sonuc.kanBasinciDurumu ? (
        <Text variant="bodySm">
          {t('altitude.bp.label')}:{' '}
          {t(`altitude.bp.${sonuc.kanBasinciDurumu}` as 'altitude.bp.normal')}
        </Text>
      ) : (
        <Text variant="caption" color="textSubtle">
          {t('altitude.bp.noEstimate')}
        </Text>
      )}

      <Text variant="caption" color="textSubtle">
        {t('altitude.disclaimer')}
      </Text>
    </View>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.metric}>
      <Text variant="caption" color="textSubtle">
        {label}
      </Text>
      <Text variant="title">{value}</Text>
      {hint ? (
        <Text variant="caption" color="textSubtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.xl, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { minWidth: 110, gap: 2 },
  reasons: { gap: 2 },
  advice: { gap: spacing.xs },
});
