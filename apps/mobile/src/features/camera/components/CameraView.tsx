import { CameraView as ExpoCameraView, type BarcodeScanningResult, type BarcodeSettings } from 'expo-camera';
import { forwardRef, ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraIcon, CloseIcon } from '@/components/log/icons';
import { Button } from '@/components/ui/button';
import { useCameraPermissions } from '@/features/camera/hooks/useCameraPermissions';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

export type CameraViewHandle = ExpoCameraView;

type CameraViewProps = {
  facing?: 'front' | 'back';
  barcodeScannerSettings?: BarcodeSettings;
  onBarcodeScanned?: (result: BarcodeScanningResult) => void;
  onClose: () => void;
  permissionTitle: string;
  permissionDescription: string;
  /** Overlay UI drawn on top of the live camera preview (reticle, capture button, ...). */
  children?: ReactNode;
};

/**
 * Permission-gated full-screen camera shell shared by BarcodeScanner and PhotoCapture.
 * Renders the right UI for each permission state, or expo-camera's own CameraView once granted.
 */
export const CameraView = forwardRef<CameraViewHandle, CameraViewProps>(function CameraView(
  { facing = 'back', barcodeScannerSettings, onBarcodeScanned, onClose, permissionTitle, permissionDescription, children },
  ref
) {
  const { state, requestPermission, openSettings } = useCameraPermissions();
  const [mountError, setMountError] = useState<string | null>(null);

  const CloseButton = (
    <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.closeButton}>
      <CloseIcon size={16} color={colors.white} strokeWidth={2.4} />
    </Pressable>
  );

  if (state !== 'granted' || mountError) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.permissionSafeArea}>
          {CloseButton}
          <View style={styles.permissionContent}>
            {state === 'checking' ? (
              <ActivityIndicator color={colors.white} />
            ) : mountError ? (
              <>
                <View style={styles.permissionIcon}>
                  <CameraIcon size={28} color={colors.white} strokeWidth={1.7} />
                </View>
                <Text style={styles.permissionTitle}>Camera unavailable</Text>
                <Text style={styles.permissionDescription}>{mountError}</Text>
              </>
            ) : (
              <>
                <View style={styles.permissionIcon}>
                  <CameraIcon size={28} color={colors.white} strokeWidth={1.7} />
                </View>
                <Text style={styles.permissionTitle}>{permissionTitle}</Text>
                <Text style={styles.permissionDescription}>{permissionDescription}</Text>
                {state === 'blocked' ? (
                  <Button label="Open Settings" onPress={openSettings} />
                ) : (
                  <Button label="Grant camera access" onPress={requestPermission} />
                )}
              </>
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ExpoCameraView
        ref={ref}
        style={StyleSheet.absoluteFill}
        facing={facing}
        barcodeScannerSettings={barcodeScannerSettings}
        onBarcodeScanned={onBarcodeScanned}
        onMountError={(event) => setMountError(event.message || 'The camera could not be started.')}
      />
      {children}
      <SafeAreaView style={styles.chromeSafeArea} pointerEvents="box-none">
        {CloseButton}
      </SafeAreaView>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.slate900,
  },
  chromeSafeArea: {
    ...StyleSheet.absoluteFill,
  },
  permissionSafeArea: {
    flex: 1,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.lg,
    marginTop: spacing.sm,
  },
  permissionContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  permissionIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  permissionTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.h1,
    color: colors.white,
    textAlign: 'center',
  },
  permissionDescription: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: fontSize.body * 1.4,
    marginBottom: spacing.sm,
  },
});
