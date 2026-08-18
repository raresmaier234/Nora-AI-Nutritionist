import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { PhotoCapture } from '@/features/camera';
import type { PhotoCaptureResult } from '@/features/camera';

export default function PhotoCaptureRoute() {
  const router = useRouter();

  const handleCaptured = useCallback(
    (result: PhotoCaptureResult) => {
      router.dismissTo({
        pathname: '/',
        params: { capturedPhotoUri: result.uri },
      });
    },
    [router]
  );

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  return <PhotoCapture onPhotoCaptured={handleCaptured} onClose={handleClose} />;
}
