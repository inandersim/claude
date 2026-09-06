import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { fontFamily, radius, spacing, useTheme } from '@/core/theme';
import type { FeedPost } from '@/domain';

import { BottomSheet } from './BottomSheet';
import { RepostCard } from './RepostCard';
import { useRepost } from '../hooks';

interface Props {
  post: FeedPost | null;
  onClose: () => void;
}

/** Yeniden paylaşım alt sayfası: isteğe bağlı not + orijinal gönderi önizlemesi. */
export function RepostSheet({ post, onClose }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const repost = useRepost();
  const [caption, setCaption] = useState('');

  const target = post?.repostOf ?? post;

  const submit = () => {
    if (!post) return;
    repost.mutate(
      { postId: post.id, caption },
      {
        onSuccess: () => {
          toast(t('social.repostToast'), 'success');
          setCaption('');
          onClose();
        },
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  return (
    <BottomSheet visible={Boolean(post)} onClose={onClose} title={t('social.repostTitle')}>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        ]}
      >
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder={t('social.repostCaption')}
          placeholderTextColor={colors.textSubtle}
          multiline
          maxLength={300}
          style={[styles.input, { color: colors.text, fontFamily: fontFamily.medium }]}
          accessibilityLabel={t('social.repostCaption')}
        />
      </View>
      <Text variant="caption" color="textSubtle" style={{ marginLeft: spacing.xs }}>
        {t('social.hashtagHint')} · {t('social.mentionHint')}
      </Text>
      {target ? <RepostCard post={target} interactive={false} /> : null}
      <Button
        label={t('social.repost')}
        icon="repeat"
        size="lg"
        fullWidth
        loading={repost.isPending}
        onPress={submit}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    minHeight: 72,
  },
  input: {
    fontSize: 15,
    lineHeight: 21,
    paddingVertical: spacing.sm + 2,
    textAlignVertical: 'top',
  },
});
