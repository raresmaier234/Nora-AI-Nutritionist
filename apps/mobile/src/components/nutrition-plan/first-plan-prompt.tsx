import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { SheetSubtitle, SheetTitle } from '@/components/ui/typography';
import { Palette, fontFamily, fontSize, spacing, useStyles } from '@/theme';

type FirstPlanPromptProps = {
  visible: boolean;
  onBuild: () => void;
  onNotNow: () => void;
  /** The sheet has finished closing: only then can the plan builder open. */
  onDismissed: () => void;
};

/** After a premium user's first sign-in: build a plan now, or not now. Offered once. */
export function FirstPlanPrompt({ visible, onBuild, onNotNow, onDismissed }: FirstPlanPromptProps) {
  const styles = useStyles(makeStyles);
  return (
    <Sheet visible={visible} onClose={onNotNow} onDismissed={onDismissed}>
      <SheetTitle>Build your plan?</SheetTitle>
      <SheetSubtitle>About 2 minutes</SheetSubtitle>
      <Text style={styles.body}>
        Tell Nora your goal, a little about your body and how active you are, and it sets your daily calories and macros around you.
      </Text>
      <View style={styles.actions}>
        <Button label="Build my plan" onPress={onBuild} />
        <Button label="Not now" variant="ghost" onPress={onNotNow} />
      </View>
    </Sheet>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    body: { fontFamily: fontFamily.medium, fontSize: fontSize.body, lineHeight: 22, color: colors.textSecondary, marginBottom: spacing.lg },
    actions: { gap: spacing.xs },
  });
