import { useCallback, useMemo } from 'react';
import { Linking } from 'react-native';
import { PermissionStatus, useCameraPermissions as useExpoCameraPermissions } from 'expo-camera';

import type { CameraPermissionState } from '@/features/camera/types/camera';

/**
 * Normalizes expo-camera's permission hook into the four states the UI actually needs to
 * branch on, plus a way to open the device's Settings app once a prompt can no longer be shown.
 */
export function useCameraPermissions() {
  const [permissionResponse, requestPermission] = useExpoCameraPermissions();

  const state: CameraPermissionState = useMemo(() => {
    if (!permissionResponse) return 'checking';
    if (permissionResponse.granted) return 'granted';
    if (!permissionResponse.canAskAgain) return 'blocked';
    if (permissionResponse.status === PermissionStatus.UNDETERMINED) return 'undetermined';
    return 'denied';
  }, [permissionResponse]);

  const openSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  return { state, requestPermission, openSettings };
}
