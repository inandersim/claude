import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';

import { Text, type TextProps } from '@/components/ui';
import { getDataProvider } from '@/data';
import { renderSegments, type ID, type TextSegment } from '@/domain';

interface Props extends Omit<TextProps, 'children'> {
  text: string;
  /** Kullanıcı adı → kimlik eşlemesi (biliniyorsa); yoksa tıklamada kullanıcı aranır */
  mentionIds?: Record<string, ID>;
  /** Tıklamayı kapatmak için (ör. önizleme) */
  interactive?: boolean;
}

/** #etiket ve @kullanıcı parçalarını vurgulayıp tıklanabilir yapan metin. */
export function RichText({ text, mentionIds, interactive = true, ...rest }: Props) {
  const router = useRouter();
  const segments = useMemo(() => renderSegments(text), [text]);

  const openMention = async (username: string) => {
    const key = username.toLocaleLowerCase('tr-TR');
    const known = mentionIds?.[key];
    if (known) {
      router.push({ pathname: '/user/[id]', params: { id: known } });
      return;
    }
    const users = await getDataProvider().social.searchUsers(username);
    const user = users.find((u) => u.username.toLocaleLowerCase('tr-TR') === key);
    if (user) router.push({ pathname: '/user/[id]', params: { id: user.id } });
  };

  const onSegment = (segment: TextSegment) => {
    if (!interactive) return undefined;
    if (segment.kind === 'hashtag') {
      return () => router.push({ pathname: '/social/tag/[tag]', params: { tag: segment.tag } });
    }
    if (segment.kind === 'mention') {
      return () => {
        openMention(segment.username).catch(() => undefined);
      };
    }
    return undefined;
  };

  return (
    <Text variant="body" {...rest}>
      {segments.map((segment, index) => {
        if (segment.kind === 'text') {
          return <React.Fragment key={index}>{segment.text}</React.Fragment>;
        }
        const onPress = onSegment(segment);
        return (
          <Text
            key={index}
            variant={rest.variant ?? 'body'}
            weight="bold"
            color={segment.kind === 'hashtag' ? 'primary' : 'accent'}
            onPress={onPress}
            suppressHighlighting
            accessibilityRole={onPress ? 'link' : undefined}
          >
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}
