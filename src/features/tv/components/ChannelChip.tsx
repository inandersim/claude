import React from 'react';

import { Chip } from '@/components/ui';
import { channelKindMeta, type TvChannel } from '@/domain';

interface Props {
  channel: TvChannel;
  selected?: boolean;
  onPress?: () => void;
}

/** Kanal rengi ve tür ikonuyla seçilebilir chip. */
export function ChannelChip({ channel, selected = false, onPress }: Props) {
  const meta = channelKindMeta[channel.kind];
  return (
    <Chip
      label={channel.name}
      icon={meta.icon}
      color={channel.color}
      selected={selected}
      onPress={onPress}
      size="sm"
    />
  );
}
