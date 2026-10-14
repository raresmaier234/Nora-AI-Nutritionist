import { ReactNode, useEffect, useRef } from 'react';
import { Modal, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors, motion } from '@/theme';

type FullScreenProps = {
  visible: boolean;
  onClose: () => void;
  /** Called once the page has fully closed — only then can another modal or route open. */
  onDismissed?: () => void;
  children: ReactNode;
  background?: string;
};

/**
 * Full-screen page that slides up over the Log (search, food details) — the design's
 * full-screen overlays, as a native modal. Its own SafeAreaProvider, because a Modal is a
 * separate native window and must measure its own insets.
 *
 * Presented `transparent` (iOS "overFullScreen") with an opaque page of its own: a plain
 * "fullScreen" modal takes the Log out of the window while it is up, and if dismissal goes
 * wrong the Log never comes back — a black screen. Never nest one FullScreen in another; put a
 * second page inside as a <FullScreenLayer> instead.
 */
export function FullScreen({ visible, onClose, onDismissed, children, background = colors.bgSurfaceSolid }: FullScreenProps) {
  // iOS reports the end of the dismiss animation through onDismiss; other platforms have no
  // such event and are done as soon as the modal is hidden.
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (wasVisible.current && !visible && Platform.OS !== 'ios') onDismissed?.();
    wasVisible.current = visible;
  }, [visible, onDismissed]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismissed}
      statusBarTranslucent>
      <SafeAreaProvider>
        <View style={[styles.root, { backgroundColor: background }]}>{children}</View>
      </SafeAreaProvider>
    </Modal>
  );
}

type FullScreenLayerProps = { children: ReactNode; background?: string };

/** A second full-screen page inside a FullScreen (e.g. Food Details over Search), sliding up. */
export function FullScreenLayer({ children, background = colors.bgSurfaceSolid }: FullScreenLayerProps) {
  const { height } = useWindowDimensions();
  const offset = useSharedValue(1);
  useEffect(() => {
    offset.value = withTiming(0, { duration: motion.slow, easing: Easing.out(Easing.cubic) });
  }, [offset]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value * height }] }));
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: background }, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
