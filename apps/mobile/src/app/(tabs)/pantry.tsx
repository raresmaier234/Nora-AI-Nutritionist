import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartIcon } from '@/components/log/icons';
import { Card } from '@/components/ui/card';
import { Palette, fontFamily, fontSize, gradientAngle, radius, spacing, trackTight, trackWide, useColors, useStyles } from '@/theme';

const STEPS = [
  { title: 'Scan your receipt', body: 'Take a photo of your shopping receipt after you shop.' },
  { title: 'Your ingredients, kept', body: 'Nora picks out only the food on it and adds it to your pantry.' },
  { title: 'Recipes for your week', body: 'Ideas made from what you already have at home.' },
];

/**
 * The Pantry tab. A placeholder for now: what it will do — scan a shopping receipt, keep only the
 * food on it as the user's ingredients, and suggest the week's recipes from them.
 */
export default function PantryScreen() {
  const colors = useColors();
  const styles = useStyles(makeStyles);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.title} accessibilityRole="header">
            Pantry
          </Text>
          <Text style={styles.subtitle}>The food you have at home, and what to cook with it.</Text>
        </View>

        <Card padding={spacing.xl}>
          <View style={styles.hero}>
            <View style={styles.mark}>
              <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
              <CartIcon size={28} color={colors.white} strokeWidth={2.2} />
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Coming soon</Text>
            </View>
            <Text style={styles.heading}>Shop, then cook what you have</Text>
          </View>

          <View style={styles.steps}>
            {STEPS.map((step, i) => (
              <View key={step.title} style={styles.step}>
                <View style={styles.number}>
                  <Text style={styles.numberText}>{i + 1}</Text>
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgApp },
    content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
    title: { fontFamily: fontFamily.extrabold, fontSize: fontSize.display, letterSpacing: trackTight(fontSize.display), color: colors.textPrimary },
    subtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, marginTop: 4 },
    hero: { alignItems: 'center', gap: spacing.md },
    mark: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: colors.glowPrimary },
    badge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: colors.chipIndigoTint, marginTop: spacing.xs },
    badgeText: { fontFamily: fontFamily.bold, fontSize: fontSize.nano, letterSpacing: trackWide(fontSize.nano), textTransform: 'uppercase', color: colors.brandPrimary },
    heading: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, letterSpacing: trackTight(fontSize.h2), color: colors.textPrimary, textAlign: 'center' },
    steps: { gap: spacing.lg, marginTop: spacing.xl },
    step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    number: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
    numberText: { fontFamily: fontFamily.extrabold, fontSize: fontSize.small, color: colors.brandPrimary },
    stepText: { flex: 1, gap: 2 },
    stepTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
    stepBody: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 19, color: colors.textSecondary },
  });
