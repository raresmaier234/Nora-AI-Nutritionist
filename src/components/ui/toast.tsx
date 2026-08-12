import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CheckIcon } from '@/components/log/icons';
import { LogColor, LogFontFamily, LogFontSize, LogMotion, LogRadius, LogShadow, LogSpace } from '@/constants/log-theme';
import type { Notify, NotifyKind } from '@/hooks/use-food-log';

export type ToastState = { id: number; kind: NotifyKind; message: string } | null;

const TOAST_DURATION_MS = 2500;

const toastEnter = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 14 }, { scale: 0.96 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(LogMotion.base);

const toastExit = new Keyframe({
  0: { opacity: 1 },
  100: { opacity: 0, easing: Easing.in(Easing.cubic) },
}).duration(LogMotion.fast);

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
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + LogSpace.xxl }]}>
      <Animated.View key={toast.id} entering={toastEnter} exiting={toastExit} style={styles.toast}>
        <View style={[styles.iconChip, toast.kind === 'success' ? styles.iconChipSuccess : styles.iconChipInfo]}>
          <CheckIcon size={15} color={LogColor.white} />
        </View>
        <Text style={styles.message} numberOfLines={2}>
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    gap: LogSpace.sm + 2,
    maxWidth: 330,
    backgroundColor: LogColor.bgSurface,
    borderRadius: LogRadius.pill,
    boxShadow: LogShadow.lg,
    paddingVertical: 9,
    paddingRight: LogSpace.xl,
    paddingLeft: 9,
  },
  iconChip: {
    width: 33,
    height: 33,
    borderRadius: LogRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipSuccess: { backgroundColor: LogColor.green500 },
  iconChipInfo: { backgroundColor: LogColor.slate600 },
  message: {
    flexShrink: 1,
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.small,
    color: LogColor.textPrimary,
  },
});
