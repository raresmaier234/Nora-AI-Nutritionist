import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';

import { LogColor, LogMotion, LogRadius, LogShadow, LogSpace } from '@/constants/log-theme';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

const backdropEnter = new Keyframe({
  0: { opacity: 0 },
  100: { opacity: 1, easing: Easing.out(Easing.cubic) },
}).duration(LogMotion.base);

const backdropExit = new Keyframe({
  0: { opacity: 1 },
  100: { opacity: 0, easing: Easing.in(Easing.cubic) },
}).duration(LogMotion.fast);

const cardEnter = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.96 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(LogMotion.base);

const cardExit = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: 0.96 }], easing: Easing.in(Easing.cubic) },
}).duration(LogMotion.fast);

/**
 * The single sheet shell every flow (add-food, edit, photo, scan, recipes, custom, unit picker)
 * renders inside of. Per product direction this is a centered dialog, not a bottom sheet —
 * a deliberate deviation from LogPageV3.jsx's bottom-anchored `Sheet`.
 */
export function Sheet({ visible, onClose, children }: SheetProps) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={backdropEnter} exiting={backdropExit} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.centerWrap}
          pointerEvents="box-none">
          <Animated.View entering={cardEnter} exiting={cardExit} style={styles.card}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: LogColor.overlayBackdrop,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: LogSpace.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '84%',
    backgroundColor: LogColor.bgSurfaceSolid,
    borderRadius: LogRadius.lg,
    boxShadow: LogShadow.lg,
  },
  scrollContent: {
    padding: LogSpace.xl,
    paddingBottom: LogSpace.xxl,
  },
});
