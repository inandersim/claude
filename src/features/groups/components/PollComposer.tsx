import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton, Input, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

/** Anket oluşturma sayfası: soru + 2–6 seçenek + çoklu seçim. */
export function PollComposer({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (poll: { question: string; options: string[]; multi: boolean }) => void;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multi, setMulti] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setQuestion('');
    setOptions(['', '']);
    setMulti(false);
    setError(null);
  };

  const submit = () => {
    const cleaned = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleaned.length < MIN_OPTIONS) {
      setError(t('groups.poll.invalid'));
      return;
    }
    onSubmit({ question: question.trim(), options: cleaned, multi });
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.background,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          },
        ]}
      >
        <View style={styles.head}>
          <Text variant="h3" style={{ flex: 1 }}>
            {t('groups.poll.title')}
          </Text>
          <IconButton
            icon="x"
            variant="ghost"
            onPress={onClose}
            accessibilityLabel={t('common.close')}
          />
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Input
            label={t('groups.poll.question')}
            placeholder={t('groups.poll.questionPlaceholder')}
            value={question}
            onChangeText={setQuestion}
            maxLength={140}
          />
          {options.map((o, i) => (
            <View key={i} style={styles.optionRow}>
              <View style={{ flex: 1 }}>
                <Input
                  label={t('groups.poll.option', { n: i + 1 })}
                  value={o}
                  onChangeText={(text) =>
                    setOptions((prev) => prev.map((p, j) => (j === i ? text : p)))
                  }
                  maxLength={80}
                />
              </View>
              {options.length > MIN_OPTIONS ? (
                <IconButton
                  icon="trash"
                  variant="ghost"
                  size={36}
                  iconSize={16}
                  onPress={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                  accessibilityLabel={t('groups.poll.removeOption')}
                  style={{ marginTop: 22 }}
                />
              ) : null}
            </View>
          ))}
          {options.length < MAX_OPTIONS ? (
            <Button
              label={t('groups.poll.addOption')}
              icon="plus"
              variant="ghost"
              size="sm"
              onPress={() => setOptions((prev) => [...prev, ''])}
            />
          ) : null}
          <View
            style={[
              styles.switchRow,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text variant="body" style={{ flex: 1 }}>
              {t('groups.poll.multi')}
            </Text>
            <Switch
              value={multi}
              onValueChange={setMulti}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel={t('groups.poll.multi')}
            />
          </View>
          {error ? (
            <Text variant="caption" color="danger">
              {error}
            </Text>
          ) : null}
          <Button label={t('groups.poll.create')} icon="send" onPress={submit} fullWidth />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '88%',
    paddingTop: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  body: { padding: spacing.lg, gap: spacing.md },
  optionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
