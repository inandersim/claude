import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Platform, StyleSheet, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { confirmDialog } from '@/core/utils/confirm';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { AiAction } from '@/domain';
import { AdviceCard } from '@/features/vision/components/AdviceCard';
import { HistoryRow } from '@/features/vision/components/HistoryRow';
import { useClearVisionHistory, useVisionHistory } from '@/features/vision/hooks';

/** Görüntü analizi geçmişi: satıra dokununca tavsiye kartı yerinde açılır. */
export default function VisionHistoryScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const history = useVisionHistory();
  const clear = useClearVisionHistory();
  const [now] = useState(() => new Date());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const items = history.data ?? [];

  const doClear = () =>
    clear.mutate(undefined, {
      onSuccess: () => toast(t('vision.historyScreen.cleared'), 'success'),
      onError: () => toast(t('common.error'), 'error'),
    });

  const confirmClear = () => {
    if (items.length === 0) return;
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(t('vision.historyScreen.clearConfirm'))) doClear();
      return;
    }
    confirmDialog(
      t('vision.historyScreen.clear'),
      t('vision.historyScreen.clearConfirm'),
      t('vision.historyScreen.clear'),
      t('common.cancel'),
      doClear,
    );
  };

  const openCamera = () => router.push('/assistant/vision');
  const onAction = (action: AiAction) => router.push(action.href as Href);

  return (
    <Screen edges={['top']}>
      <Header
        title={t('vision.historyScreen.title')}
        subtitle={t('vision.historyScreen.subtitle', { count: items.length })}
        showBack
        right={
          <View style={styles.headerRight}>
            <IconButton
              icon="camera"
              variant="ghost"
              onPress={openCamera}
              accessibilityLabel={t('vision.historyScreen.open')}
            />
            <IconButton
              icon="trash"
              variant="ghost"
              color={colors.danger}
              onPress={confirmClear}
              disabled={items.length === 0 || clear.isPending}
              accessibilityLabel={t('vision.historyScreen.clear')}
            />
          </View>
        }
      />
      {history.isError ? (
        <ErrorState onRetry={() => history.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <HistoryRow
                item={item}
                now={now}
                onPress={() => setExpandedId((id) => (id === item.id ? null : item.id))}
              />
              {expandedId === item.id ? (
                <View style={styles.expanded}>
                  <AdviceCard advice={item} onAction={onAction} />
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            history.isLoading ? (
              <View style={styles.skeletons}>
                <Skeleton height={88} style={{ borderRadius: radius.lg }} />
                <Skeleton height={88} style={{ borderRadius: radius.lg }} />
                <Skeleton height={88} style={{ borderRadius: radius.lg }} />
              </View>
            ) : (
              <EmptyState
                icon="camera"
                title={t('vision.historyScreen.empty')}
                description={t('vision.historyScreen.emptyBody')}
                action={{
                  label: t('vision.historyScreen.open'),
                  icon: 'camera',
                  onPress: openCamera,
                }}
              />
            )
          }
          ListFooterComponent={
            items.length > 0 ? (
              <Text variant="caption" color="textSubtle" align="center" style={styles.footer}>
                {t('vision.disclaimer')}
              </Text>
            ) : null
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  row: { marginBottom: spacing.xs },
  expanded: { marginBottom: spacing.md },
  skeletons: { gap: spacing.sm },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});
