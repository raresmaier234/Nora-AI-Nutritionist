import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/theme';

/**
 * Single "Home" tab today (Log is the whole app). Add more `NativeTabs.Trigger`s here
 * as real features (Dashboard, Profile, ...) land — the shell is already wired for it.
 */
export default function AppTabs() {
  return (
    <NativeTabs tintColor={colors.brandPrimary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
