import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Chip, SegmentedControl, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/core/theme';
import { readMinutes, wordCount } from '@/domain';

import { ArticleBody } from './ArticleBody';

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  minHeight?: number;
}

type Mode = 'editor' | 'preview';

/**
 * Basit markdown editörü: çok satırlı giriş, araç çubuğu (başlık / alt başlık /
 * liste / alıntı / görsel) ve önizleme geçişi. Eklemeler imleç konumuna,
 * satır başına gelecek biçimde yapılır.
 */
export function MarkdownEditor({ value, onChange, error, minHeight = 260 }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('editor');
  const [selection, setSelection] = useState({ start: value.length, end: value.length });

  const words = wordCount(value);

  /** Seçimin başındaki satırın başına önek ekler (satır başında değilse yeni satır açar). */
  const insertLinePrefix = (prefix: string) => {
    const at = Math.min(selection.start, value.length);
    const before = value.slice(0, at);
    const after = value.slice(at);
    const needsBreak = before.length > 0 && !before.endsWith('\n');
    const lead = needsBreak ? (before.endsWith('\n\n') ? '' : '\n\n') : '';
    const next = `${before}${lead}${prefix}${after}`;
    onChange(next);
    const cursor = before.length + lead.length + prefix.length;
    setSelection({ start: cursor, end: cursor });
  };

  const insertImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    const uri = result.canceled ? null : result.assets[0]?.uri;
    if (!uri) return;
    insertLinePrefix(`![${t('articles.write.imagePlaceholder')}](${uri})\n\n`);
  };

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <SegmentedControl<Mode>
          segments={[
            { value: 'editor', label: t('articles.write.editor') },
            { value: 'preview', label: t('articles.write.preview') },
          ]}
          value={mode}
          onChange={setMode}
        />
      </View>
      {mode === 'editor' ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolbar}
            keyboardShouldPersistTaps="always"
          >
            <Chip label="H1" size="sm" onPress={() => insertLinePrefix('# ')} />
            <Chip label="H2" size="sm" onPress={() => insertLinePrefix('## ')} />
            <Chip
              label={t('articles.write.toolbar.list')}
              icon="list-checks"
              size="sm"
              onPress={() => insertLinePrefix('- ')}
            />
            <Chip
              label={t('articles.write.toolbar.quote')}
              icon="message-square"
              size="sm"
              onPress={() => insertLinePrefix('> ')}
            />
            <Chip
              label={t('articles.write.toolbar.image')}
              icon="image-plus"
              size="sm"
              onPress={() => {
                insertImage().catch(() => undefined);
              }}
            />
          </ScrollView>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: error ? colors.danger : colors.border,
                minHeight,
              },
            ]}
          >
            <TextInput
              value={value}
              onChangeText={onChange}
              onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
              placeholder={t('articles.write.bodyPlaceholder')}
              placeholderTextColor={colors.textSubtle}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
              style={[styles.input, { color: colors.text, fontFamily: fontFamily.regular }]}
              accessibilityLabel={t('articles.write.body')}
            />
          </View>
        </>
      ) : (
        <View
          style={[
            styles.preview,
            { backgroundColor: colors.surface, borderColor: colors.border, minHeight },
          ]}
        >
          {value.trim() ? (
            <ArticleBody body={value} />
          ) : (
            <Text variant="bodySm" color="textSubtle">
              {t('articles.write.bodyPlaceholder')}
            </Text>
          )}
        </View>
      )}
      <View style={styles.foot}>
        <Text variant="caption" color={error ? 'danger' : 'textSubtle'}>
          {error ?? t('articles.write.wordCount', { words, min: readMinutes(value) })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  top: { alignSelf: 'stretch' },
  toolbar: { gap: spacing.sm, paddingVertical: 2 },
  inputWrap: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  input: { fontSize: 15, lineHeight: 22, flex: 1, minHeight: 200 },
  preview: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  foot: { flexDirection: 'row', justifyContent: 'flex-end' },
});
