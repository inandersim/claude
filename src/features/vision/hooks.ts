import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState, type RefObject } from 'react';

import { queryKeys } from '@/core/query/keys';
import { getDataProvider } from '@/data';
import type { VisionAdvice, VisionHistoryItem, VisionRequest } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';

/* ------------------------------------------------------------------ */
/* Veri                                                                 */
/* ------------------------------------------------------------------ */

/** Görüntüyü analiz eder; başarıda geçmiş sorgusunu tazeler. */
export function useVisionAnalyze() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation<VisionAdvice, Error, VisionRequest>({
    mutationFn: (input) => getDataProvider().vision.analyze(me.id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.vision.history(me.id) });
    },
  });
}

export function useVisionHistory() {
  const me = useCurrentUser();
  return useQuery<VisionHistoryItem[]>({
    queryKey: queryKeys.vision.history(me.id),
    queryFn: () => getDataProvider().vision.history(me.id),
  });
}

export function useClearVisionHistory() {
  const me = useCurrentUser();
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => getDataProvider().vision.clearHistory(me.id),
    onSuccess: () => {
      qc.setQueryData<VisionHistoryItem[]>(queryKeys.vision.history(me.id), []);
      qc.invalidateQueries({ queryKey: queryKeys.vision.history(me.id) });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Kamera / galeri                                                      */
/* ------------------------------------------------------------------ */

/** Çekilen ya da seçilen kare: dosya URI'si ve base64 verisi (data: öneksiz). */
export interface CameraFrame {
  uri: string;
  base64: string | null;
  width?: number;
  height?: number;
}

/** Fotoğraf kalitesi; base64 boyutunu 3 MB sınırının altında tutar. */
const CAPTURE_QUALITY = 0.5;

interface UseCameraFrameResult {
  /** `CameraView` bileşenine verilecek ref */
  cameraRef: RefObject<CameraView | null>;
  /** Kamera hazır olduğunda `onCameraReady` ile işaretle */
  markReady: () => void;
  isReady: boolean;
  isCapturing: boolean;
  /** Kameradan kare yakalar; kamera hazır değilse ya da hata olursa null döner */
  capture: () => Promise<CameraFrame | null>;
  /** Galeriden fotoğraf seçer (web dahil); iptalde null */
  pickFromLibrary: () => Promise<CameraFrame | null>;
}

/**
 * `expo-camera` `CameraView` ref'i ile `takePictureAsync({ base64: true, quality: 0.5 })`;
 * kamera olmayan ortamda (web) `expo-image-picker` ile galeri seçimi. Her iki yol
 * `{ uri, base64 }` döner.
 */
export function useCameraFrame(): UseCameraFrameResult {
  const cameraRef = useRef<CameraView | null>(null);
  const [isReady, setReady] = useState(false);
  const [isCapturing, setCapturing] = useState(false);

  const markReady = useCallback(() => setReady(true), []);

  const capture = useCallback(async (): Promise<CameraFrame | null> => {
    const cam = cameraRef.current;
    if (!cam || isCapturing) return null;
    setCapturing(true);
    try {
      const photo = await cam.takePictureAsync({
        base64: true,
        quality: CAPTURE_QUALITY,
        skipProcessing: false,
      });
      if (!photo?.uri) return null;
      return {
        uri: photo.uri,
        base64: photo.base64 ?? null,
        width: photo.width,
        height: photo.height,
      };
    } catch {
      return null;
    } finally {
      setCapturing(false);
    }
  }, [isCapturing]);

  const pickFromLibrary = useCallback(async (): Promise<CameraFrame | null> => {
    if (isCapturing) return null;
    setCapturing(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: CAPTURE_QUALITY,
        allowsEditing: false,
        selectionLimit: 1,
      });
      if (result.canceled) return null;
      const asset = result.assets[0];
      if (!asset?.uri) return null;
      return {
        uri: asset.uri,
        base64: asset.base64 ?? null,
        width: asset.width,
        height: asset.height,
      };
    } catch {
      return null;
    } finally {
      setCapturing(false);
    }
  }, [isCapturing]);

  return { cameraRef, markReady, isReady, isCapturing, capture, pickFromLibrary };
}
