import { Link, Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, EmptyState, Screen } from '@/components/ui';
import { useT } from '@/core/i18n';

export default function NotFoundScreen() {
  const { t } = useT();
  return (
    <>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <Screen edges={['top', 'bottom']}>
        <View style={styles.center}>
          <EmptyState
            icon="compass"
            title={t('notFound.title')}
            description={t('notFound.description')}
          />
          <Link href="/" asChild>
            <Button label={t('notFound.goHome')} icon="house" />
          </Link>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
