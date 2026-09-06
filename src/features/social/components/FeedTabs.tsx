import React from 'react';
import { StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing } from '@/core/theme';
import { FEED_TABS, type FeedTabValue } from '@/domain';

interface Props {
  value: FeedTabValue;
  onChange: (value: FeedTabValue) => void;
}

/** Akış sekmeleri: Tümü / Takip / Maceralar / Durumlar */
export function FeedTabs({ value, onChange }: Props) {
  const { t } = useT();
  return (
    <View style={styles.root}>
      <SegmentedControl<FeedTabValue>
        segments={FEED_TABS.map((tab) => ({ value: tab, label: t(`social.tabs.${tab}`) }))}
        value={value}
        onChange={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: spacing.lg },
});
