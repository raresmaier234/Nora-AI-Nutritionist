import { ReactNode, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Palette, motion, radius, spacing, useColors, useStyles } from '@/theme';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Called once the sheet has fully closed — only then can another modal or route open. */
  onDismissed?: () => void;
  children: ReactNode;
};

/**
 * The single sheet shell every flow (add-food, edit, photo, scan, recipes, custom, unit picker)
 * renders inside of. Per product direction this is a centered dialog, not a bottom sheet —
 * a deliberate deviation from LogPageV3.jsx's bottom-anchored `Sheet`.
 *
 * The backdrop fade is handled by Modal's native `animationType="fade"` rather than a Reanimated
 * `entering`/`exiting` Keyframe: those layout animations rely on a web DOM-measurement path that's
 * unreliable once a Modal is nested inside another Modal (the unit picker opens from inside the
 * edit/custom-food sheets) — it silently leaves the second sheet stuck at opacity 0. The card's
 * scale-in "pop" instead uses a plain mount-driven shared value, which doesn't hit that path.
 *
 * Closes from the X in its top-right corner, a tap on the backdrop, or Android's back button.
 */
export function Sheet({ visible, onClose, onDismissed, children }: SheetProps) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const scale = useSharedValue(0.96);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: motion.base, easing: Easing.out(Easing.cubic) });
      scale.value = withTiming(1, { duration: motion.base, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = 0;
      scale.value = 0.96;
    }
  }, [visible, opacity, scale]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  // iOS reports the end of the dismiss animation through onDismiss; other platforms have no
  // such event and are done as soon as the modal is hidden.
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (wasVisible.current && !visible && Platform.OS !== 'ios') onDismissed?.();
    wasVisible.current = visible;
  }, [visible, onDismissed]);

  // Kept mounted while hidden, so iOS runs the dismiss and reports onDismiss.
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={onDismissed} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.centerWrap}
          pointerEvents="box-none">
          <Animated.View style={[styles.card, cardStyle]}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth={2.8} strokeLinecap="round">
                <Path d="M18 6 6 18M6 6l12 12" />
              </Svg>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlayBackdrop,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '84%',
    backgroundColor: colors.bgSurfaceSolid,
    borderRadius: radius.lg,
    boxShadow: colors.shadowLg,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  close: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
});
