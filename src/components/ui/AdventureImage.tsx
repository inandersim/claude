import { Image, type ImageContentFit } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ADVENTURE_TYPE_META, type AdventureType } from '@/domain';
import { kucukBoyYolu, medyaCdnTabani, medyaUrl } from '@/domain/media';

import { Icon } from './Icon';

export interface AdventureImageProps {
  uri: string | null | undefined;
  adventureType: AdventureType;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  /** Görselin üzerine koyu geçiş (metin okunabilirliği için) */
  overlay?: boolean;
  /**
   * Küçük boy iste (liste/ızgara kartı). Tam ekranda **verme**: 400 px'lik
   * dosya büyütülünce bulanık görünür.
   */
  kucuk?: boolean;
  children?: React.ReactNode;
}

/**
 * Macera görseli. Görsel yüklenemezse macera türünün gradyanı ve ikonu ile
 * tasarım bütünlüğünü koruyan bir yedek gösterir.
 */
export function AdventureImage({
  uri,
  adventureType,
  style,
  contentFit = 'cover',
  overlay = false,
  kucuk = false,
  children,
}: AdventureImageProps) {
  const [failed, setFailed] = useState(false);
  // Küçük boy 404 verirse tam boya düşülür. Bu kuraldan **önce** yüklenmiş
  // görsellerin küçük boyu yoktur; onlar için tek doğru davranış budur ve
  // geçmişi göç ettirmeden çalışır.
  const [kucukYok, setKucukYok] = useState(false);
  const meta = ADVENTURE_TYPE_META[adventureType];
  // Yönlendirme çizim anında: veritabanında hâlihazırda duran adresler de
  // CDN'e gider ve CDN kapatılınca göç gerekmeden eski davranışa dönülür.
  const tam = medyaUrl(uri, medyaCdnTabani());
  const kaynak = tam && kucuk && !kucukYok ? kucukBoyYolu(tam) : tam;
  const showFallback = !kaynak || failed;

  // `uri` değişince hata durumu sıfırlanır: liste öğeleri geri dönüştürülür
  // (recycle) ve eski bir hatanın yeni görseli yedeğe düşürmesi gerekmez.
  const [oncekiUri, setOncekiUri] = useState(uri);
  if (oncekiUri !== uri) {
    setOncekiUri(uri);
    setFailed(false);
    setKucukYok(false);
  }

  return (
    <View style={[styles.root, style]}>
      {showFallback ? (
        <LinearGradient
          colors={meta.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        >
          <View style={styles.fallbackIcon}>
            <Icon name={meta.icon} size={48} color="rgba(255,255,255,0.35)" strokeWidth={1.5} />
          </View>
        </LinearGradient>
      ) : (
        <Image
          source={{ uri: kaynak }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={300}
          cachePolicy="memory-disk"
          // Küçük boy yoksa önce tam boya düş; o da yüklenmezse yedek görsel.
          onError={() => (kaynak !== tam ? setKucukYok(true) : setFailed(true))}
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
        />
      )}
      {overlay ? (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(4,8,6,0.85)']}
          locations={[0.35, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden', backgroundColor: '#18251F' },
  fallbackIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
