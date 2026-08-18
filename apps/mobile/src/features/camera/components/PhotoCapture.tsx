import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraView, type CameraViewHandle } from '@/features/camera/components/CameraView';
import type { PhotoCaptureResult } from '@/features/camera/types/camera';
import { colors, spacing } from '@/theme';

type PhotoCaptureProps = {
  onPhotoCaptured: (result: PhotoCaptureResult) => void;
  onClose: () => void;
};

/** Full-screen photo capture: live preview + native-style shutter button. */
export function PhotoCapture({ onPhotoCaptured, onClose }: PhotoCaptureProps) {
  const cameraRef = useRef<CameraViewHandle>(null);
  const [capturing, setCapturing] = useState(false);

  const handleCapture = useCallback(async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        onPhotoCaptured({ uri: photo.uri });
      }
    } catch {
      // No camera hardware available (e.g. simulator) — fail silently, user can retry or close.
    } finally {
      setCapturing(false);
    }
  }, [capturing, onPhotoCaptured]);

  return (
    <CameraView
      ref={cameraRef}
      onClose={onClose}
      permissionTitle="Camera access needed"
      permissionDescription="Nora needs camera access to take a photo of your food.">
      <SafeAreaView style={styles.controls} pointerEvents="box-none">
        <Pressable
          onPress={handleCapture}
          disabled={capturing}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          style={[styles.shutter, capturing && styles.shutterDisabled]}>
          <View style={styles.shutterInner} />
        </Pressable>
      </SafeAreaView>
    </CameraView>
  );
}

const styles = StyleSheet.create({
  controls: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xxxl,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: {
    opacity: 0.5,
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
  },
});
