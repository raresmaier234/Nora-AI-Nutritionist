import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { SectionLabel, SheetSubtitle, SheetTitle } from '@/components/ui/typography';
import { colors, fontFamily, fontSize, spacing } from '@/theme';
import { API_BASE_URL, API_VERSION_PREFIX, ApiError, apiRequest, getHealth } from '@/services/api';

type CheckState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: unknown }
  | { status: 'error'; error: ApiError };

/**
 * Throwaway connectivity check for the API client — not linked from the tab bar, reached only
 * by direct navigation during development. Safe to delete once real API-backed screens exist.
 */
export default function ApiHealthDevScreen() {
  const router = useRouter();
  const [state, setState] = useState<CheckState>({ status: 'idle' });

  const run = useCallback((fn: () => Promise<unknown>) => {
    setState({ status: 'loading' });
    fn()
      .then((data) => setState({ status: 'success', data }))
      .catch((err: unknown) => {
        const error =
          err instanceof ApiError ? err : new ApiError({ kind: 'network', message: String(err), path: 'unknown' });
        setState({ status: 'error', error });
      });
  }, []);

  const handleClose = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <SheetTitle>API Health Check</SheetTitle>
        <Button label="Close" variant="ghost" onPress={handleClose} />
      </View>
      <SheetSubtitle>{`${API_BASE_URL}${API_VERSION_PREFIX}`}</SheetSubtitle>

      <View style={styles.actions}>
        <Button label="Check /health" onPress={() => run(getHealth)} disabled={state.status === 'loading'} />
        <Button
          label="Trigger /auth (expect 501)"
          variant="secondary"
          onPress={() => run(() => apiRequest('/auth'))}
          disabled={state.status === 'loading'}
        />
      </View>

      <ScrollView style={styles.result}>
        <SectionLabel>Result</SectionLabel>
        {state.status === 'idle' && <Text style={styles.hint}>Tap a button above.</Text>}
        {state.status === 'loading' && <ActivityIndicator color={colors.brandPrimary} />}
        {state.status === 'success' && <Text style={styles.success}>{JSON.stringify(state.data, null, 2)}</Text>}
        {state.status === 'error' && (
          <Text style={styles.error}>
            {`[${state.error.kind}]${state.error.status ? ` HTTP ${state.error.status}` : ''}\n${state.error.message}`}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgApp, padding: spacing.xl },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  actions: { gap: spacing.md, marginTop: spacing.lg },
  result: { marginTop: spacing.xl },
  hint: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textTertiary },
  success: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.greenText },
  error: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.stateError },
});
