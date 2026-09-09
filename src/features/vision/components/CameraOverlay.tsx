import React from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { Chip, Icon, IconButton, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/core/theme';
import type { VisionSituation } from '@/domain';

import { SituationChips } from './SituationChips';

export interface CameraOverlayProps {
  situation: VisionSituation;
  onSituationChange: (situation: VisionSituation) => void;
  question: string;
  onQuestionChange: (text: string) => void;
  /** Deklanşörün üstünde gösterilen hızlı soru önerileri */
  quickQuestions: string[];
  onCapture: () => void;
  onPickFromLibrary: () => void;
  capturing?: boolean;
  /** Kamera hazır değilken deklanşör pasif */
  ready?: boolean;
  /** Üst çubuk (kapat/flaş/çevir) ekran tarafından verilir */
  topBar?: React.ReactNode;
  /** Güvenli alan boşlukları */
  paddingTop?: number;
  paddingBottom?: number;
}

const CORNER = 26;
const CORNER_WIDTH = 3;

/** Kadraj köşeleri. */
function Corners({ color }: { color: string }) {
  return (
    <View style={[styles.frame, { pointerEvents: 'none' }]}>
      <View style={[styles.corner, styles.tl, { borderColor: color }]} />
      <View style={[styles.corner, styles.tr, { borderColor: color }]} />
      <View style={[styles.corner, styles.bl, { borderColor: color }]} />
      <View style={[styles.corner, styles.br, { borderColor: color }]} />
    </View>
  );
}

/**
 * Kamera üstü katman: köşe çerçeveleri, üstte ipucu, altta durum çipleri,
 * kısa soru girişi ve büyük deklanşör (+ galeri kısayolu).
 */
export function CameraOverlay({
  situation,
  onSituationChange,
  question,
  onQuestionChange,
  quickQuestions,
  onCapture,
  onPickFromLibrary,
  capturing = false,
  ready = true,
  topBar,
  paddingTop = 0,
  paddingBottom = 0,
}: CameraOverlayProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const light = '#FFFFFF';
  const disabled = capturing || !ready;

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
      <Corners color="rgba(255,255,255,0.85)" />

      <View style={[styles.top, { paddingTop: paddingTop + spacing.sm }, { pointerEvents: 'box-none' }]}>
        {topBar}
        <View style={styles.hint}>
          <Icon name="sparkles" size={14} color={light} />
          <Text variant="caption" color={light} weight="bold">
            {t(`vision.hint.${situation}`)}
          </Text>
        </View>
      </View>

      <View
        style={[styles.bottom, { paddingBottom: paddingBottom + spacing.md }, { pointerEvents: 'box-none' }]}
      >
        <SituationChips
          value={situation}
          onChange={onSituationChange}
          disabled={capturing}
          color={colors.primary}
          size="sm"
        />

        {quickQuestions.length > 0 ? (
          <View style={styles.quick}>
            {quickQuestions.map((q) => (
              <Chip
                key={q}
                label={q}
                size="sm"
                selected={question === q}
                color={colors.primary}
                onPress={capturing ? undefined : () => onQuestionChange(question === q ? '' : q)}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.inputWrap}>
          <Icon name="message-circle" size={16} color="rgba(255,255,255,0.8)" />
          <TextInput
            value={question}
            onChangeText={onQuestionChange}
            placeholder={t('vision.questionPlaceholder')}
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={[styles.input, { fontFamily: fontFamily.medium }]}
            maxLength={200}
            returnKeyType="done"
            accessibilityLabel={t('vision.questionPlaceholder')}
          />
        </View>

        <View style={styles.controls}>
          <IconButton
            icon="image"
            variant="blur"
            size={48}
            color={light}
            onPress={onPickFromLibrary}
            disabled={capturing}
            accessibilityLabel={t('vision.gallery')}
          />
          <Tappable
            onPress={onCapture}
            disabled={disabled}
            haptic="medium"
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel={t('vision.shutter')}
            accessibilityState={{ disabled }}
            style={[styles.shutterOuter, { opacity: disabled ? 0.5 : 1 }]}
          >
            <View style={[styles.shutterInner, { backgroundColor: colors.primary }]}>
              {capturing ? (
                <ActivityIndicator color="#06120B" />
              ) : (
                <Icon name="camera" size={28} color="#06120B" strokeWidth={2.4} />
              )}
            </View>
          </Tappable>
          <View style={styles.spacer} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    top: '22%',
    bottom: '38%',
    left: '10%',
    right: '10%',
  },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 8,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 8,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 8,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 8,
  },
  top: { gap: spacing.sm },
  hint: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    marginHorizontal: spacing.lg,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  quick: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  inputWrap: {
    marginHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  input: { flex: 1, color: '#FFFFFF', fontSize: 14, paddingVertical: 0 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xs,
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: 48 },
});
