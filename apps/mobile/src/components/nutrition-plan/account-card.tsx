import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Palette, fontFamily, fontSize, gradientAngle, radius, spacing, trackWide, useColors, useStyles } from '@/theme';
import type { Plan } from '@/services/api';

type AccountCardProps = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  /** Null while the profile loads. */
  plan: Plan | null;
  /** How they signed in, e.g. 'google' or 'apple'. */
  provider: string | null;
};

const PROVIDERS: Record<string, string> = { google: 'Google', apple: 'Apple', email: 'email code' };

/** Who's signed in: picture (or initials), name, email, Basic / Premium and how they signed in. */
export function AccountCard({ name, email, avatarUrl, plan, provider }: AccountCardProps) {
  const styles = useStyles(makeStyles);
  const providerName = provider ? PROVIDERS[provider] : undefined;
  return (
    <Card padding={18} style={styles.card}>
      <Avatar name={name} email={email} url={avatarUrl} />
      <View style={styles.text}>
        {/* No name (an email-code sign-in): the email is the title instead. */}
        <Text style={styles.name} numberOfLines={1}>
          {name || email || 'Your account'}
        </Text>
        {name && email ? (
          <Text style={styles.email} numberOfLines={1}>
            {email}
          </Text>
        ) : null}
        <View style={styles.meta}>
          {plan ? <PlanBadge plan={plan} /> : null}
          {providerName ? <Text style={styles.provider}>via {providerName}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

function initials(name: string | null, email: string | null) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return email ? email[0].toUpperCase() : '?';
}

function Avatar({ name, email, url }: { name: string | null; email: string | null; url: string | null }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  if (url) return <Image source={{ uri: url }} style={styles.avatar} contentFit="cover" accessibilityLabel="Profile picture" />;
  return (
    <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={styles.avatar}>
      <Text style={styles.initials}>{initials(name, email)}</Text>
    </LinearGradient>
  );
}

/** Basic or Premium. Premium is filled with the brand gradient. */
function PlanBadge({ plan }: { plan: Plan }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const premium = plan === 'premium';
  return (
    <View style={[styles.badge, !premium && styles.badgeBasic]} accessibilityLabel={`${premium ? 'Premium' : 'Basic'} plan`}>
      {premium ? (
        <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
      ) : null}
      <Text style={[styles.badgeText, premium && styles.badgeTextPremium]}>{premium ? 'Premium' : 'Basic'}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    initials: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h1, color: colors.white },
    text: { flex: 1, minWidth: 0 },
    name: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h2, color: colors.textPrimary },
    email: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textSecondary, marginTop: 2 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
    provider: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary },
    badge: { borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10, overflow: 'hidden' },
    badgeBasic: { backgroundColor: colors.surfaceMuted },
    badgeText: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.nano,
      letterSpacing: trackWide(fontSize.nano),
      textTransform: 'uppercase',
      color: colors.textSecondary,
    },
    badgeTextPremium: { color: colors.textOnBrand },
  });
