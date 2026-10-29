import { CameraView as ExpoCameraView, type BarcodeScanningResult, type BarcodeSettings } from 'expo-camera';
import { forwardRef, ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraIcon, CloseIcon } from '@/components/log/icons';
import { Button } from '@/components/ui/button';
import { useCameraPermissions } from '@/features/camera/hooks/useCameraPermissions';
import { Palette, fontFamily, fontSize, radius, spacing, useColors, useStyles } from '@/theme';

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
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { state, requestPermission, openSettings } = useCameraPermissions();
  const [mountError, setMountError] = useState<string | null>(null);

  // Placed from the safe-area insets, above everything else, with a dark fill so it reads on a
  // bright preview: it is the only way out of the full-screen camera.
  const CloseButton = (
    <Pressable
      onPress={onClose}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Close camera"
      style={[styles.closeButton, { top: insets.top + spacing.sm }]}>
      <CloseIcon size={18} color={colors.white} strokeWidth={2.6} />
    </Pressable>
  );

  if (state !== 'granted' || mountError) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.permissionSafeArea}>
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
        {CloseButton}
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
      {CloseButton}
    </View>
  );
});

const makeStyles = (colors: Palette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.slate900,
  },
  permissionSafeArea: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    left: spacing.lg,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
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
