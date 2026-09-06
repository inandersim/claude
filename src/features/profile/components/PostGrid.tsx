import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { AdventureImage, Icon, Tappable, Text } from '@/components/ui';
import { radius, spacing } from '@/core/theme';
import { ADVENTURE_TYPE_META, isSocialPost, postImages, type FeedPost } from '@/domain';

export function PostGrid({ posts }: { posts: FeedPost[] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const columns = width >= 768 ? 4 : 3;
  const gap = spacing.xs + 2;
  const size = (Math.min(width, 640) - spacing.lg * 2 - gap * (columns - 1)) / columns;

  return (
    <View style={[styles.grid, { gap }]}>
      {posts.map((post) => {
        const meta = ADVENTURE_TYPE_META[post.adventureType];
        // Durum/fotoğraf gönderilerinde rakım anlamsızdır (hep 0); metin önizlemesi gösterilir.
        const social = isSocialPost(post);
        const cover = postImages(post)[0] ?? null;
        return (
          <Tappable
            key={post.id}
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
            scaleTo={0.95}
            style={{ width: size, height: size }}
            accessibilityRole="imagebutton"
            accessibilityLabel={post.caption}
          >
            <AdventureImage uri={cover} adventureType={post.adventureType} style={styles.cell}>
              <View style={[styles.typeDot, { backgroundColor: meta.color }]}>
                <Icon
                  name={social && !cover ? 'message-square' : meta.icon}
                  size={10}
                  color="#06120B"
                  strokeWidth={2.8}
                />
              </View>
              {social ? (
                !cover && post.caption ? (
                  <View style={styles.captionWrap}>
                    <Text variant="label" weight="bold" color="#FFFFFF" numberOfLines={4}>
                      {post.caption}
                    </Text>
                  </View>
                ) : null
              ) : (
                <View style={styles.altitude}>
                  <Text variant="label" weight="extrabold" color="#FFFFFF">
                    {post.altitudeM} m
                  </Text>
                </View>
              )}
            </AdventureImage>
          </Tappable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg },
  cell: { flex: 1, borderRadius: radius.md },
  typeDot: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionWrap: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    top: 26,
    justifyContent: 'flex-end',
  },
  altitude: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
    justifyContent: 'center',
  },
});
