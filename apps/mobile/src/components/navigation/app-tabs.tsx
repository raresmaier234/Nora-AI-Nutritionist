import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { PlusIcon, SparkleIcon } from '@/components/log/icons';
import { Palette, fontFamily, fontSize, gradientAngle, spacing, useColors, useStyles } from '@/theme';

type TabIcon = (props: { color: string; filled: boolean }) => React.ReactNode;

// Seven slots share the bar, so labels stay short ("Log", not "Food Log"); `a11yLabel` is
// the full name for screen readers where it differs.
const TABS: { name: string; href: '/' | '/log' | '/pantry' | '/nora' | '/strategy' | '/more'; label: string; a11yLabel?: string; icon: TabIcon }[] = [
  { name: 'index', href: '/', label: 'Dashboard', icon: DashboardIcon },
  { name: 'log', href: '/log', label: 'Log', a11yLabel: 'Food Log', icon: LogIcon },
  { name: 'pantry', href: '/pantry', label: 'Pantry', icon: PantryIcon },
  { name: 'nora', href: '/nora', label: 'Nora', icon: NoraIcon },
  { name: 'strategy', href: '/strategy', label: 'Strategy', icon: StrategyIcon },
  { name: 'more', href: '/more', label: 'More', icon: MoreIcon },
];

/**
 * The app's tab bar: Dashboard, Log, Pantry, a raised + in the middle, Nora, Strategy and More. Built
 * with expo-router/ui (docs.expo.dev/router/advanced/custom-tabs): a hidden TabList defines the
 * routes, and the bar draws its own buttons — a native tab bar can't hold the + action, which
 * isn't a page but opens Add food over the Food Log from any tab.
 */
export default function AppTabs() {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // A fresh value each tap, so the Food Log sees a change even when it's already open.
  const addFood = () => router.navigate({ pathname: '/log', params: { addFood: String(Date.now()) } });

  return (
    <Tabs>
      <TabSlot />
      <TabList style={styles.hidden}>
        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} />
        ))}
      </TabList>

      <View style={[styles.bar, { paddingBottom: Math.max(8, insets.bottom) }]} accessibilityRole="tablist">
        {TABS.slice(0, 3).map((t) => (
          <TabTrigger key={t.name} name={t.name} asChild>
            <TabButton label={t.label} a11yLabel={t.a11yLabel} icon={t.icon} />
          </TabTrigger>
        ))}
        <View style={styles.addSlot}>
          <Pressable onPress={addFood} accessibilityRole="button" accessibilityLabel="Add food" style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
            <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
            <PlusIcon size={22} color={colors.white} strokeWidth={2.8} />
          </Pressable>
        </View>
        {TABS.slice(3).map((t) => (
          <TabTrigger key={t.name} name={t.name} asChild>
            <TabButton label={t.label} a11yLabel={t.a11yLabel} icon={t.icon} />
          </TabTrigger>
        ))}
      </View>
    </Tabs>
  );
}

// TabTrigger's ref is typed for a View; a Pressable's differs in this React Native, and the
// button needs no ref, so it isn't passed on.
function TabButton({ label, a11yLabel, icon: Icon, isFocused, ref: _ref, ...props }: TabTriggerSlotProps & { label: string; a11yLabel?: string; icon: TabIcon }) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const color = isFocused ? colors.brandPrimary : colors.textTertiary;
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} accessibilityLabel={a11yLabel ?? label} style={styles.tab}>
      <Icon color={color} filled={!!isFocused} />
      <Text style={[styles.label, { color }, isFocused && styles.labelOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
    </Pressable>
  );
}

// Tab icons, 24-unit line art like components/log/icons.tsx; filled when the tab is open.

function DashboardIcon({ color, filled }: { color: string; filled: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2} strokeLinejoin="round">
      <Rect x={3.5} y={3.5} width={7} height={9} rx={2} />
      <Rect x={13.5} y={3.5} width={7} height={5} rx={2} />
      <Rect x={13.5} y={11.5} width={7} height={9} rx={2} />
      <Rect x={3.5} y={15.5} width={7} height={5} rx={2} />
    </Svg>
  );
}

function LogIcon({ color, filled }: { color: string; filled: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {/* A chicken drumstick: the meat, then the bone and its knobbed end */}
      <Path d="M8.5 15.5C7 12 8 8 10.5 5.8c3-2.6 7.5-2.3 9.1-.4 1.9 2 1.4 6.1-1.4 8.6-2.5 2.3-6.2 3-9.7 1.5z" fill={filled ? color : 'none'} />
      <Path d="M8.5 15.5l-3 3" />
      <Circle cx={4.3} cy={18.2} r={1.6} />
      <Circle cx={5.8} cy={19.7} r={1.6} />
    </Svg>
  );
}

function PantryIcon({ color, filled }: { color: string; filled: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2.5 3.5h2.6l.9 4.3" />
      <Path d="M6 7.8h14.5l-1.6 6.9a1.6 1.6 0 0 1-1.6 1.3H9a1.6 1.6 0 0 1-1.6-1.3z" fill={filled ? color : 'none'} />
      <Circle cx={9.5} cy={20} r={1.3} fill={color} stroke="none" />
      <Circle cx={17.5} cy={20} r={1.3} fill={color} stroke="none" />
    </Svg>
  );
}

function NoraIcon({ color, filled }: { color: string; filled: boolean }) {
  return <SparkleIcon size={22} color={color} fill={filled ? color : 'none'} strokeWidth={2} />;
}

function StrategyIcon({ color, filled }: { color: string; filled: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx={12} cy={12} r={8.5} />
      <Circle cx={12} cy={12} r={4.5} />
      <Circle cx={12} cy={12} r={1.4} fill={color} stroke={filled ? color : 'none'} />
    </Svg>
  );
}

function MoreIcon({ color, filled }: { color: string; filled: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={12} cy={12} r={9} fill={filled ? color : 'none'} />
      {[8, 12, 16].map((x) => (
        <Circle key={x} cx={x} cy={12} r={1.2} fill={filled ? '#FFFFFF' : color} stroke="none" />
      ))}
    </Svg>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    hidden: { display: 'none' },
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingTop: 8,
      paddingHorizontal: spacing.xs,
      backgroundColor: colors.bgSurfaceSolid,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    },
    tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
    label: { fontFamily: fontFamily.semibold, fontSize: fontSize.nano },
    labelOn: { fontFamily: fontFamily.bold },
    addSlot: { flex: 1, alignItems: 'center' },
    add: { width: 52, height: 52, marginTop: -18, borderRadius: 26, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: colors.glowPrimary },
    addPressed: { transform: [{ scale: 0.94 }] },
  });
