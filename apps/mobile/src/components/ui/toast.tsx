import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon } from '@/components/log/icons';
import { Palette, fontFamily, fontSize, motion, radius, spacing, useColors, useStyles } from '@/theme';
import type { Notify, NotifyKind } from '@/features/food/hooks/use-food-log';

export type ToastState = { id: number; kind: NotifyKind; message: string } | null;

const TOAST_DURATION_MS = 2500;

/** Owns toast queue state; pair with <ToastOverlay toast={toast} /> rendered at the screen root. */
export function useToastHost() {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify: Notify = useCallback((kind, message) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, kind, message });
    timer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), TOAST_DURATION_MS);
  }, []);

  return { notify, toast };
}

export function ToastOverlay({ toast }: { toast: ToastState }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  useEffect(() => {
    if (toast) {
      opacity.value = 0;
      translateY.value = 14;
      opacity.value = withTiming(1, { duration: motion.base, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(0, { duration: motion.base, easing: Easing.out(Easing.cubic) });
    }
  }, [toast, opacity, translateY]);

  const toastStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + spacing.xxl }]}>
      <Animated.View key={toast.id} style={[styles.toast, toastStyle]}>
        <View style={[styles.iconChip, toast.kind === 'success' ? styles.iconChipSuccess : styles.iconChipInfo]}>
          <CheckIcon size={15} color={colors.white} />
        </View>
        <Text style={styles.message} numberOfLines={2}>
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    maxWidth: 330,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.pill,
    boxShadow: colors.shadowLg,
    paddingVertical: 9,
    paddingRight: spacing.xl,
    paddingLeft: 9,
  },
  iconChip: {
    width: 33,
    height: 33,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipSuccess: { backgroundColor: colors.successFill },
  iconChipInfo: { backgroundColor: colors.slate600 },
  message: {
    flexShrink: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.small,
    color: colors.textPrimary,
  },
});
