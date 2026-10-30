import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { SheetSubtitle, SheetTitle } from '@/components/ui/typography';
import { Palette, fontFamily, fontSize, spacing, useStyles } from '@/theme';

/**
 * "Change plan" until the plan builder exists: it says what's coming. The builder will ask what
 * the user wants to change and rebuild the plan from their answers
 * (apps/api/docs/plans/ai-nutrition-plan.md) — targets are never typed in by hand.
 */
export function ChangePlanSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles(makeStyles);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <SheetTitle>Change your plan</SheetTitle>
      <SheetSubtitle>Coming soon</SheetSubtitle>
      <Text style={styles.body}>
        Nora will ask what you’d like to change — your goal, how fast you want to get there, how active you are or how you
        eat — and rebuild your plan around your answers.
      </Text>
      <Text style={styles.body}>Until then, your plan stays at these daily targets.</Text>
      <Button label="OK" onPress={onClose} style={styles.button} />
    </Sheet>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    body: { fontFamily: fontFamily.medium, fontSize: fontSize.body, lineHeight: 22, color: colors.textSecondary, marginBottom: spacing.md },
    button: { marginTop: spacing.sm },
  });
