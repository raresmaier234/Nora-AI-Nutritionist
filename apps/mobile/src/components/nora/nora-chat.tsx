import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertIcon, ArrowRightIcon, ArrowUpIcon, SparkleIcon } from '@/components/log/icons';
import { MAX_MESSAGE_CHARS, type ChatTurn, useNoraChat } from '@/features/nora/use-nora-chat';
import { Palette, fontFamily, fontSize, gradientAngle, radius, spacing, trackTight, trackWide, useColors, useStyles } from '@/theme';

/** Questions to start with. Without targets, none that are about calories. */
const SUGGESTIONS = ['What should I eat for dinner?', 'How am I doing today?', 'A high-protein snack idea', 'Explain my daily targets'];
const SUGGESTIONS_NO_TARGETS = ['What should I eat for dinner?', 'Ideas for a balanced breakfast', 'A snack to take to work', 'How can I eat more vegetables?'];

/**
 * The Nora tab's chat (premium): ask about meals, what to eat next, or the plan. Answers come from
 * POST /nora/chat, which sees today's log; the conversation stays in this screen (see
 * useNoraChat). The input sits on the keyboard, measured the way the Add food search bar is.
 */
export function NoraChat({ name, withoutTargets }: { name: string | null; withoutTargets: boolean }) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { turns, sending, error, send, retry, reset } = useNoraChat();
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollToEnd = () => scrollRef.current?.scrollToEnd({ animated: true });

  // How far the keyboard covers this screen: its bottom edge against the keyboard's top, in
  // window coordinates (the tab bar under the screen is covered too, so it doesn't count).
  const rootRef = useRef<ViewInstance>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      const keyboardTop = e.endCoordinates.screenY;
      rootRef.current?.measureInWindow((_x, y, _w, h) => setKeyboardInset(Math.max(0, y + h - keyboardTop)));
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const submit = (text: string) => {
    if (!text.trim() || sending) return;
    send(text);
    setDraft('');
  };
  const canSend = draft.trim().length > 0 && !sending;
  const firstName = name?.trim().split(/\s+/)[0];

  return (
    <View ref={rootRef} style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <NoraMark size={34} />
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            Nora
          </Text>
          <Text style={styles.subtitle}>Your nutrition assistant</Text>
        </View>
        {turns.length > 0 ? (
          <Pressable onPress={reset} accessibilityRole="button" hitSlop={8} style={({ pressed }) => [styles.newChat, pressed && styles.pressed]}>
            <Text style={styles.newChatText}>New chat</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.flex, { paddingBottom: keyboardInset }]}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}>
          {turns.length === 0 ? (
            <Welcome firstName={firstName} suggestions={withoutTargets ? SUGGESTIONS_NO_TARGETS : SUGGESTIONS} onPick={submit} />
          ) : (
            turns.map((turn) => <Bubble key={turn.id} turn={turn} />)
          )}
          {sending ? (
            <View style={styles.noraRow} accessibilityLiveRegion="polite">
              <NoraMark size={26} />
              <View style={[styles.noraBubble, styles.thinking]}>
                <ActivityIndicator size="small" color={colors.brandPrimary} />
                <Text style={styles.thinkingText}>Nora is thinking…</Text>
              </View>
            </View>
          ) : null}
          {error ? (
            <View style={styles.error} accessibilityLiveRegion="polite">
              <AlertIcon size={16} color={colors.errorText} />
              <Text style={styles.errorText}>{error}</Text>
              <Text onPress={retry} accessibilityRole="button" style={styles.retry}>
                Try again
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: keyboardInset ? 8 : 10 }]}>
          <View style={[styles.field, focused && styles.fieldFocused]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Ask Nora about food"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Message Nora"
              multiline
              maxLength={MAX_MESSAGE_CHARS}
              selectionColor={colors.brandPrimary}
              style={styles.input}
            />
            <Pressable
              onPress={() => submit(draft)}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !canSend }}
              style={({ pressed }) => [styles.send, !canSend && styles.sendOff, pressed && styles.pressed]}>
              {canSend ? <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} /> : null}
              <ArrowUpIcon size={17} color={canSend ? colors.white : colors.textTertiary} />
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>Nora can get things wrong. General guidance, not medical advice.</Text>
        </View>
      </View>
    </View>
  );
}

function Welcome({ firstName, suggestions, onPick }: { firstName?: string; suggestions: string[]; onPick: (text: string) => void }) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  return (
    <View style={styles.welcome}>
      <View style={styles.welcomeTop}>
        <NoraMark size={64} />
        <Text style={styles.welcomeTitle}>{firstName ? `Hi ${firstName}, I’m Nora` : 'Hi, I’m Nora'}</Text>
        <Text style={styles.welcomeBody}>Ask me about your meals, what to eat next, or how your plan works. I can see what you’ve logged today.</Text>
      </View>

      <Text style={styles.overline}>Try asking</Text>
      <View style={styles.suggestions}>
        {suggestions.map((s) => (
          <Pressable key={s} onPress={() => onPick(s)} accessibilityRole="button" style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}>
            <View style={styles.suggestionIcon}>
              <SparkleIcon size={14} color={colors.brandPrimary} strokeWidth={2.2} />
            </View>
            <Text style={styles.suggestionText}>{s}</Text>
            <ArrowRightIcon size={13} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>

      <Text style={styles.privacy}>
        To answer, your messages and today’s log are sent to Anthropic (Claude). Nothing is saved: the chat is cleared when you close the app.
      </Text>
    </View>
  );
}

function Bubble({ turn }: { turn: ChatTurn }) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  if (turn.role === 'user') {
    return (
      <View style={styles.userBubble}>
        <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
        <Text style={styles.userText} selectable>
          {turn.content}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.noraRow}>
      <NoraMark size={26} />
      <View style={styles.noraBubble}>
        <Text style={styles.noraText} selectable>
          {turn.content}
        </Text>
      </View>
    </View>
  );
}

/** Nora's avatar: the sparkle on the brand gradient. */
function NoraMark({ size }: { size: number }) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }, size >= 48 && styles.markGlow]}>
      <LinearGradient colors={colors.gradPrimary} start={gradientAngle.start} end={gradientAngle.end} style={StyleSheet.absoluteFill} />
      <SparkleIcon size={Math.round(size * 0.52)} color={colors.white} fill={colors.white} strokeWidth={1.4} />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgApp },
    flex: { flex: 1 },
    pressed: { opacity: 0.75 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    headerText: { flex: 1 },
    title: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h1, letterSpacing: trackTight(fontSize.h1), color: colors.textPrimary },
    subtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary },
    newChat: { paddingVertical: 7, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.chipIndigoTint },
    newChatText: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.brandPrimary },

    messages: { flexGrow: 1, padding: spacing.lg, gap: spacing.md },
    mark: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    markGlow: { boxShadow: colors.glowPrimary },

    welcome: { flex: 1, justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.lg },
    welcomeTop: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    welcomeTitle: { fontFamily: fontFamily.extrabold, fontSize: fontSize.h1, letterSpacing: trackTight(fontSize.h1), color: colors.textPrimary, textAlign: 'center', marginTop: spacing.sm },
    welcomeBody: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 19, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg },
    overline: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: trackWide(fontSize.micro) },
    suggestions: { gap: spacing.sm },
    suggestion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.bgSurfaceSolid,
      boxShadow: colors.shadowSm,
    },
    suggestionPressed: { backgroundColor: colors.brandWash, borderColor: colors.brandPrimary },
    suggestionIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.chipIndigoTint, alignItems: 'center', justifyContent: 'center' },
    suggestionText: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textPrimary },
    privacy: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, lineHeight: 16, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.sm },

    userBubble: {
      alignSelf: 'flex-end',
      maxWidth: '84%',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderBottomRightRadius: 6,
      overflow: 'hidden',
    },
    userText: { fontFamily: fontFamily.medium, fontSize: fontSize.body, lineHeight: 21, color: colors.white },
    noraRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, maxWidth: '92%' },
    noraBubble: {
      flexShrink: 1,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderBottomLeftRadius: 6,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.bgSurfaceSolid,
      boxShadow: colors.shadowSm,
    },
    noraText: { fontFamily: fontFamily.medium, fontSize: fontSize.body, lineHeight: 21, color: colors.textPrimary },
    thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    thinkingText: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.textSecondary },
    error: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: colors.dangerTint,
    },
    errorText: { flex: 1, minWidth: 160, fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.errorText },
    retry: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.brandPrimary },

    inputBar: { paddingTop: 8, paddingHorizontal: spacing.md, gap: 6, backgroundColor: colors.bgSurfaceSolid, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
    field: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingLeft: spacing.lg,
      paddingRight: 5,
      paddingVertical: 5,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.bgSurfaceSolid,
      boxShadow: colors.shadowSm,
    },
    fieldFocused: { borderColor: colors.brandPrimary },
    input: { flex: 1, minWidth: 0, maxHeight: 120, paddingTop: 8, paddingBottom: 8, fontFamily: fontFamily.medium, fontSize: 16, lineHeight: 21, color: colors.textPrimary },
    send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    sendOff: { backgroundColor: colors.surfaceMuted },
    disclaimer: { fontFamily: fontFamily.medium, fontSize: fontSize.nano, color: colors.textTertiary, textAlign: 'center' },
  });
