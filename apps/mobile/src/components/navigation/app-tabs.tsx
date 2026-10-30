import { NativeTabs } from 'expo-router/native-tabs';

import { useColors } from '@/theme';

/**
 * Home (the Log) and Profile (the nutrition plan and daily targets, with the account at its foot). Add more `NativeTabs.Trigger`s here as real features (Dashboard,
 * ...) land. Icons: SF Symbols on iOS, Material Symbols on Android.
 */
export default function AppTabs() {
  const colors = useColors();
  return (
    <NativeTabs tintColor={colors.brandPrimary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
