import React, { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { useToast } from '@/core/hooks/useToast';
import { confirmDialog } from '@/core/utils/confirm';
import { useT } from '@/core/i18n';
import type { FeedPost, ReactionType } from '@/domain';

import { RepostSheet } from './components/RepostSheet';
import { SaveSheet } from './components/SaveSheet';
import { useDeletePost, useReact, useToggleSave } from './hooks';

/**
 * PostCard aksiyonlarını (tepki, kaydet, yeniden paylaş, sil) ve bunlara ait
 * alt sayfaları tek yerde toplar; ekranlar `sheets`i render eder.
 */
export function usePostCardActions(onDeleted?: () => void) {
  const { t } = useT();
  const toast = useToast();
  const react = useReact();
  const toggleSave = useToggleSave();
  const deletePost = useDeletePost();
  const [repostTarget, setRepostTarget] = useState<FeedPost | null>(null);
  const [saveTarget, setSaveTarget] = useState<FeedPost | null>(null);

  const onReact = useCallback(
    (postId: string, type: ReactionType | null) => react.mutate({ postId, type }),
    [react],
  );
  const onToggleSave = useCallback(
    (postId: string) =>
      toggleSave.mutate(
        { postId },
        {
          onSuccess: (p) =>
            toast(p.savedByMe ? t('social.savedToast') : t('social.unsavedToast'), 'success'),
        },
      ),
    [toggleSave, toast, t],
  );
  const onSaveLongPress = useCallback((post: FeedPost) => setSaveTarget(post), []);
  const onRepost = useCallback((post: FeedPost) => setRepostTarget(post), []);

  const onDelete = useCallback(
    (post: FeedPost) => {
      const run = () =>
        deletePost.mutate(post.id, {
          onSuccess: () => {
            toast(t('social.deleted'), 'success');
            onDeleted?.();
          },
          onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
        });
      if (Platform.OS === 'web') {
        run();
        return;
      }
      confirmDialog(
        t('social.delete'),
        t('social.deleteConfirm'),
        t('common.delete'),
        t('common.cancel'),
        run,
      );
    },
    [deletePost, onDeleted, t, toast],
  );

  const sheets = (
    <>
      <RepostSheet post={repostTarget} onClose={() => setRepostTarget(null)} />
      <SaveSheet post={saveTarget} onClose={() => setSaveTarget(null)} />
    </>
  );

  return { onReact, onToggleSave, onSaveLongPress, onRepost, onDelete, sheets };
}
