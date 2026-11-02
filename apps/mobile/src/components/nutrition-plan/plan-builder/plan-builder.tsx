import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegalLink } from '@/components/common/legal-link';
import { ChevronLeftIcon, CloseIcon } from '@/components/log/icons';
import { Button } from '@/components/ui/button';
import { FullScreen } from '@/components/ui/full-screen';
import { Palette, fontFamily, fontSize, gradientAngle, radius, spacing, useColors, useStyles } from '@/theme';
import { LEGAL_LINKS } from '@/features/auth';
import {
  ACTIVITY_OPTIONS,
  CHANGE_OPTIONS,
  ED_STATUS_OPTIONS,
  GOAL_OPTIONS,
  HEALTH_OPTIONS,
  HYPO_RISK_OPTIONS,
  LIFTING_OPTIONS,
  SEX_OPTIONS,
  TARGETS_WANTED_OPTIONS,
  goalLabel,
} from '@/features/nutrition-plan/options';
import {
  ALL_SECTIONS,
  CONSENT_VERSION,
  Draft,
  FlowContext,
  MEALS,
  QUESTIONNAIRE_VERSION,
  STEP_SECTION,
  Section,
  StepId,
  completeAnswers,
  defaultPace,
  isGateStep,
  isMuscleGoal,
  needsDiabetesAck,
  nextStep,
  partialAnswers,
  planLanguage,
  sanitize,
  stepComplete,
  unusualAnswer,
  visibleSteps,
} from '@/features/nutrition-plan/questionnaire';
import {
  GoalAnswers,
  NutritionGoalKind,
  NutritionPlan,
  PlanGate,
  PlanPreview,
  activatePlan,
  createPlanDraft,
  describeError,
  gateFromError,
  getLatestGoals,
  previewPlan,
  saveGoals,
} from '@/services/api';

import { GateScreen, ReviewScreen, StopScreen, gateChoices } from './outcomes';
import { ChoiceList, ChoiceRow, MultiChoiceList, StepHeader } from './parts';
import { BirthStep, ExerciseStep, FoodStep, HeightStep, PaceStep, TargetStep, WeightStep } from './steps';

/**
 * - `build`: the whole questionnaire (answers saved before are filled in).
 * - `change`: "What would you like to change?" first, then only those questions.
 * - `recheck`: "Something changed?" — the given sections again (health, by default); the gates
 *   run again.
 */
export type PlanBuilderMode = 'build' | 'change' | 'recheck';
export type PlanBuilderRequest = { mode: PlanBuilderMode; sections?: Section[] };

type PlanBuilderProps = {
  /** Open while set; a new `key` starts a new run. */
  request: (PlanBuilderRequest & { key: number }) | null;
  onClose: () => void;
  /** "Use this plan" succeeded: the plan is active and its targets are the user's. */
  onActivated: (plan: NutritionPlan) => void;
  /** A stop was reached (and recorded): the user now logs without targets. */
  onStopped: () => void;
};

/**
 * The plan questionnaire, full screen: questions one at a time with a progress bar and Back /
 * Next, gate and stop screens, then the review with "Use this plan". The spec is
 * apps/api/docs/plans/ai-nutrition-plan.md; which screens show, and their validation, live in
 * src/features/nutrition-plan/questionnaire.ts. Rendered once, by PlanBuilderHost.
 */
export function PlanBuilder({ request, onClose, onActivated, onStopped }: PlanBuilderProps) {
  const colors = useColors();
  const flow = useRef<FlowHandle>(null);
  return (
    <FullScreen visible={request !== null} onClose={() => (flow.current ? flow.current.back() : onClose())} background={colors.bgApp}>
      {request ? <Flow ref={flow} key={request.key} request={request} onClose={onClose} onActivated={onActivated} onStopped={onStopped} /> : null}
    </FullScreen>
  );
}

type FlowHandle = { back: () => void };

type Phase =
  | { kind: 'loading' }
  | { kind: 'loadError'; message: string }
  | { kind: 'question' }
  | { kind: 'gate'; gate: PlanGate; anchor: StepId }
  | { kind: 'stop'; stop: PlanGate['stop'] }
  | { kind: 'review'; plan: NutritionPlan };

type FlowProps = Omit<PlanBuilderProps, 'request'> & { request: PlanBuilderRequest; ref: Ref<FlowHandle> };

function Flow({ request, onClose, onActivated, onStopped, ref }: FlowProps) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [today] = useState(() => new Date());
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [draft, setDraft] = useState<Draft>({});
  const [initial, setInitial] = useState<Draft>({});
  const [initialGoal, setInitialGoal] = useState<NutritionGoalKind | undefined>(undefined);
  const [sections, setSections] = useState<ReadonlySet<Section>>(new Set());
  const [needsConsent, setNeedsConsent] = useState(false);
  const [changeFirst, setChangeFirst] = useState(false);
  const [consented, setConsented] = useState(false);
  const [changeChoice, setChangeChoice] = useState<(Section | 'all')[]>([]);
  /** Screens visited, the current one last: Back pops it. */
  const [history, setHistory] = useState<StepId[]>([]);
  const [pacePreview, setPacePreview] = useState<PlanPreview | null>(null);
  /** The muscle goal "Not right now" to training switched away from, for "Yes" after coming back. */
  const [trainGoal, setTrainGoal] = useState<NutritionGoalKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The latest saved answers: they decide whether consent is asked, and fill the screens in.
  const { mode, sections: requestedSections } = request;
  useEffect(() => {
    let cancelled = false;
    getLatestGoals()
      .then((latest) => {
        if (cancelled) return;
        // Changing or re-checking needs earlier answers; without any it's a fresh build.
        const runMode = latest?.answers ? mode : 'build';
        const start: Draft = latest?.answers ? { ...latest.answers } : { units: 'metric' };
        const asked = new Set<Section>(runMode === 'build' ? ALL_SECTIONS : runMode === 'recheck' ? (requestedSections ?? ['health']) : []);
        const ctx: FlowContext = { draft: start, initial: start, sections: asked, needsConsent: !latest, changeFirst: runMode === 'change', initialGoal: start.goal };
        setDraft(start);
        setInitial(start);
        setInitialGoal(start.goal);
        setSections(asked);
        setNeedsConsent(!latest);
        setChangeFirst(runMode === 'change');
        setHistory([nextStep(null, ctx) ?? 'goal']);
        setPhase({ kind: 'question' });
      })
      .catch((err: unknown) => {
        if (!cancelled) setPhase({ kind: 'loadError', message: describeError(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [mode, requestedSections, loadAttempt]);

  const ctx: FlowContext = { draft, initial, sections, needsConsent, changeFirst, initialGoal };
  const current: StepId | undefined = history[history.length - 1];
  const update = (patch: Draft) => setDraft((d) => ({ ...d, ...patch }));

  const record = (gate: PlanGate, d: Draft) => {
    setPhase({ kind: 'stop', stop: gate.stop });
    // Saving the answers is what switches the account to "log without targets" (the API keeps
    // nothing for under-16s). The stop screen shows either way.
    saveGoals({
      questionnaire_version: QUESTIONNAIRE_VERSION,
      consent: true,
      consent_version: CONSENT_VERSION,
      language: planLanguage(),
      answers: partialAnswers(d) as GoalAnswers,
    })
      .catch(() => {
        // Nothing to undo: no plan is made either way.
      })
      .finally(onStopped);
  };

  const submit = async (d: Draft, anchor: StepId) => {
    const answers = completeAnswers(d);
    if (!answers) {
      setError('Some answers are missing. Go back and check them.');
      return;
    }
    try {
      const saved = await saveGoals({
        questionnaire_version: QUESTIONNAIRE_VERSION,
        consent: true,
        consent_version: CONSENT_VERSION,
        language: planLanguage(),
        answers,
      });
      if (saved.id === null || saved.gate.result === 'stop') {
        setPhase({ kind: 'stop', stop: saved.gate.stop });
        onStopped();
        return;
      }
      setPhase({ kind: 'review', plan: await createPlanDraft(saved.id) });
    } catch (err) {
      const gate = gateFromError(err);
      if (gate?.result === 'stop') {
        setPhase({ kind: 'stop', stop: gate.stop });
        onStopped();
      } else if (gate) {
        setPhase({ kind: 'gate', gate, anchor });
      } else {
        setError(describeError(err));
      }
    }
  };

  /** Moves to `step` (null: the review), filling in that screen's defaults. */
  const enter = async (step: StepId | null, d: Draft, from: StepId) => {
    if (step === null) {
      setDraft(d);
      await submit(d, from);
      return;
    }
    let next = d;
    // Log without targets is the default after "it's in the past".
    if (step === 'targets') next = { ...next, targets_wanted: next.targets_wanted ?? false };
    if (step === 'exercise') next = { ...next, strength_days: next.strength_days ?? 0, cardio_days: next.cardio_days ?? 0 };
    if (step === 'target' && isMuscleGoal(next.goal) && next.target_weight_kg === undefined) next = { ...next, target_weight_kg: null };
    if (step === 'food') next = { ...next, meals_per_day: next.meals_per_day ?? MEALS.default, allergies: next.allergies ?? [] };
    if (step === 'pace') {
      // Each pace's real weekly rate and date, for these answers.
      const preview = await previewPlan(partialAnswers(next, ['pace', 'target_date']), planLanguage());
      if (preview.gate.result === 'stop') return record(preview.gate, next);
      // The goal changed since the gates last ran (e.g. "Switch to Lose fat and build muscle"
      // on the target screen) and isn't allowed: pick another, then the target comes again.
      if (next.goal && !preview.gate.allowed_goals.includes(next.goal)) {
        setDraft(next);
        setPhase({ kind: 'gate', gate: preview.gate, anchor: 'lifting' });
        return;
      }
      setPacePreview(preview);
      next = { ...next, pace: defaultPace(next, preview) };
    }
    setDraft(next);
    setHistory((h) => [...h, step]);
  };

  /** Next, from the current screen. `answers` replaces the draft (e.g. Skip's defaults). */
  const advance = async (answers: Draft = draft) => {
    if (!current) return;
    setError(null);
    let d = sanitize(answers);
    let c: FlowContext = { ...ctx, draft: d };
    if (current === 'change') {
      const startOver = changeChoice.includes('all');
      const asked = new Set<Section>(startOver ? ALL_SECTIONS : changeChoice.filter((s): s is Section => s !== 'all'));
      if (startOver) {
        d = { units: d.units ?? 'metric' };
        setInitial(d);
        setInitialGoal(undefined);
      }
      setSections(asked);
      c = { ...c, draft: d, sections: asked, initial: startOver ? d : initial, initialGoal: startOver ? undefined : initialGoal };
    }
    // "Not right now" to training: Maintain instead of Gain muscle, Lose fat instead of Lose fat
    // and build muscle.
    if (current === 'willTrain' && d.will_train === false && isMuscleGoal(d.goal)) {
      setTrainGoal(d.goal ?? null);
      d = sanitize({ ...d, goal: untrainedGoal(d.goal) });
      c = { ...c, draft: d };
    }
    const next = nextStep(current, c);
    setBusy(true);
    try {
      // Too young? Asked with the age alone, so other saved answers can't stop someone early.
      if (current === 'birth') {
        const age = await previewPlan(partialAnswers({ goal: d.goal, birth_year: d.birth_year, birth_month: d.birth_month }), planLanguage());
        if (age.gate.result === 'stop') return record(age.gate, d);
      }
      // Leaving the age, body and health screens: run the safety gates.
      if (isGateStep(current) && (next === null || !isGateStep(next))) {
        const preview = await previewPlan(partialAnswers(d), planLanguage());
        if (preview.gate.result === 'stop') return record(preview.gate, d);
        if (d.goal && !preview.gate.allowed_goals.includes(d.goal)) {
          setDraft(d);
          setPhase({ kind: 'gate', gate: preview.gate, anchor: current });
          return;
        }
      }
      await enter(next, d, current);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const goNext = () => {
    if (busy || !current) return;
    const unusual = unusualAnswer(current, draft);
    if (!unusual) return void advance();
    Alert.alert('Just checking', unusual, [
      { text: 'Edit', style: 'cancel' },
      { text: 'Yes, that’s right', onPress: () => void advance() },
    ]);
  };

  /** A gate's "Continue with Maintain" (or another allowed goal). */
  const chooseGoal = async (goal: NutritionGoalKind) => {
    if (phase.kind !== 'gate') return;
    const d = sanitize({ ...draft, goal });
    const anchor = phase.anchor;
    setPhase({ kind: 'question' });
    setError(null);
    setBusy(true);
    try {
      await enter(nextStep(anchor, { ...ctx, draft: d }), d, anchor);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const acceptPlan = async () => {
    if (phase.kind !== 'review') return;
    setError(null);
    setBusy(true);
    try {
      onActivated(await activatePlan(phase.plan.id));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  /** "Change my answers": back to the first question, every answer kept. */
  const changeAnswers = () => {
    setError(null);
    setHistory([nextStep('consent', ctx) ?? 'goal']);
    setPhase({ kind: 'question' });
  };

  const requestClose = () => {
    const started = (phase.kind === 'question' && history.length > 1) || phase.kind === 'gate' || phase.kind === 'review';
    if (!started) return onClose();
    Alert.alert(
      phase.kind === 'review' ? 'Leave without this plan?' : 'Stop building your plan?',
      phase.kind === 'review' ? 'Your current targets stay as they are.' : 'Your answers so far won’t be saved.',
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: onClose },
      ],
    );
  };

  const goBack = () => {
    if (busy) return;
    setError(null);
    if (phase.kind === 'gate' || phase.kind === 'review') return setPhase({ kind: 'question' });
    if (phase.kind !== 'question') return onClose();
    if (history.length > 1) return setHistory((h) => h.slice(0, -1));
    requestClose();
  };

  // Android's back button and the modal's own close: one step back.
  useImperativeHandle(ref, () => ({ back: goBack }));

  // ---- Progress ----
  const steps = visibleSteps(ctx);
  const position = current ? Math.max(steps.indexOf(current), history.length - 1) : 0;
  const progress = phase.kind === 'review' ? 1 : Math.min(1, (position + 1) / (steps.length + 1));
  // (What follows "What would you like to change?" isn't known until it's answered.)
  const isLast = current !== undefined && current !== 'change' && phase.kind === 'question' && nextStep(current, ctx) === null;
  const canGoBack = phase.kind === 'gate' || phase.kind === 'review' || (phase.kind === 'question' && history.length > 1);

  // ---- Screens ----
  const renderStep = (step: StepId) => {
    switch (step) {
      case 'consent':
        return (
          <>
            <StepHeader
              eyebrow={STEP_SECTION.consent}
              title="Your answers, your plan"
              helper="Nora uses your answers, including health information, to build and adjust your plan."
            />
            <View style={styles.consentCard}>
              <Text style={styles.consentText}>
                Your answers are stored only in Nora, used to build and adjust your plan, and you can delete them any time.
              </Text>
              <Text style={styles.consentText}>
                Read more in our <LegalLink link={LEGAL_LINKS.privacy} linkStyle={styles.link} />.
              </Text>
            </View>
            <ChoiceRow kind="checkbox" label="I agree" selected={consented} onPress={() => setConsented((v) => !v)} />
          </>
        );
      case 'change':
        return (
          <>
            <StepHeader eyebrow={STEP_SECTION.change} title="What would you like to change?" helper="Nora asks only those questions again and keeps your other answers." />
            <MultiChoiceList options={CHANGE_OPTIONS} values={changeChoice} onChange={setChangeChoice} accessibilityLabel="What to change" />
          </>
        );
      case 'goal':
        return (
          <>
            <StepHeader eyebrow={STEP_SECTION.goal} title="What’s your main goal right now?" helper="You can change this any time." />
            <ChoiceList options={GOAL_OPTIONS} value={draft.goal} onChange={(goal) => update({ goal })} accessibilityLabel="Goal" />
          </>
        );
      case 'birth':
        return <BirthStep draft={draft} update={update} today={today} />;
      case 'sex':
        return (
          <>
            <StepHeader
              eyebrow={STEP_SECTION.sex}
              title="Which should we use for your energy estimate?"
              helper="Energy formulas differ by sex. On hormone therapy? Choose what fits your body now, or Prefer not to say."
            />
            <ChoiceList options={SEX_OPTIONS} value={draft.sex} onChange={(sex) => update({ sex })} accessibilityLabel="Sex" />
          </>
        );
      case 'height':
        return <HeightStep draft={draft} update={update} />;
      case 'weight':
        return <WeightStep draft={draft} update={update} />;
      case 'health': {
        const shown = HEALTH_OPTIONS.filter((o) => !(o.notForMale && draft.sex === 'male'));
        return (
          <>
            <StepHeader eyebrow={STEP_SECTION.health} title="Does any of these apply to you?" helper="We ask so your plan is safe. Your answers stay private in Nora." />
            <MultiChoiceList
              options={shown}
              values={(draft.health ?? []).filter((h) => shown.some((o) => o.value === h))}
              onChange={(health) => update({ health })}
              accessibilityLabel="Health"
            />
          </>
        );
      }
      case 'diabetes':
        return (
          <>
            <StepHeader
              eyebrow={STEP_SECTION.diabetes}
              title="Do you take insulin, or tablets that can cause low blood sugar (hypos), such as gliclazide or glimepiride?"
              helper="It changes how fast it’s safe to go."
            />
            <ChoiceList options={HYPO_RISK_OPTIONS} value={draft.diabetes_hypo_risk} onChange={(v) => update({ diabetes_hypo_risk: v })} accessibilityLabel="Hypo risk" />
            {needsDiabetesAck(draft) ? (
              <View style={styles.gap}>
                <ChoiceRow
                  kind="checkbox"
                  label="I’ll check with my diabetes team"
                  description="Needed to choose Lose fat with these medicines: eating less can change your blood sugar."
                  selected={!!draft.diabetes_team_ack}
                  onPress={() => update({ diabetes_team_ack: !draft.diabetes_team_ack })}
                />
              </View>
            ) : null}
          </>
        );
      case 'eatingDisorder':
        return (
          <>
            <StepHeader eyebrow={STEP_SECTION.eatingDisorder} title="Thanks for telling us. Is it something you’re dealing with now?" />
            <ChoiceList options={ED_STATUS_OPTIONS} value={draft.ed_status} onChange={(v) => update({ ed_status: v })} accessibilityLabel="Eating disorder, now or in the past" />
          </>
        );
      case 'targets':
        return (
          <>
            <StepHeader
              eyebrow={STEP_SECTION.targets}
              title="How would you like to use Nora?"
              helper="Many people in recovery find calorie numbers unhelpful, so Nora can leave them out. You can change this any time."
            />
            <ChoiceList
              options={TARGETS_WANTED_OPTIONS}
              value={draft.targets_wanted === true ? 'yes' : draft.targets_wanted === false ? 'no' : null}
              onChange={(v) => update({ targets_wanted: v === 'yes' })}
              accessibilityLabel="How you’d like to use Nora"
            />
          </>
        );
      case 'activity':
        return (
          <>
            <StepHeader
              eyebrow={STEP_SECTION.activity}
              title="Outside of workouts, how active is a normal day?"
              helper="Don’t count workouts; they’re next. Your phone’s step count is a good guide. Between two? Pick the lower one."
            />
            <ChoiceList options={ACTIVITY_OPTIONS} value={draft.activity} onChange={(activity) => update({ activity })} accessibilityLabel="Daily activity" />
          </>
        );
      case 'exercise':
        return <ExerciseStep draft={draft} update={update} />;
      case 'willTrain': {
        const muscleGoal = isMuscleGoal(draft.goal) ? draft.goal! : (trainGoal ?? 'build_muscle');
        const fallback = untrainedGoal(muscleGoal);
        return (
          <>
            <StepHeader
              eyebrow={STEP_SECTION.willTrain}
              title="Will you train at least 2 days a week?"
              helper={
                muscleGoal === 'recomp'
                  ? 'Building muscle while you lose fat takes strength training; eating less without it loses muscle too.'
                  : 'Muscle is built by strength training; extra food alone mostly adds fat.'
              }
            />
            <ChoiceList
              options={[
                { value: 'yes', label: 'Yes, at least 2 days a week' },
                {
                  value: 'no',
                  label: 'Not right now',
                  description:
                    fallback === 'lose_fat'
                      ? 'Then Lose fat fits better for now: lose weight slowly while keeping muscle.'
                      : 'Then Maintain fits better for now: eat well and stay about where you are.',
                },
              ]}
              value={draft.will_train === true ? 'yes' : draft.will_train === false ? 'no' : null}
              // "Not right now" switches goal on Next; "Yes" (e.g. after coming back) restores the muscle goal.
              onChange={(v) => update(v === 'yes' ? { will_train: true, goal: muscleGoal } : { will_train: false })}
              accessibilityLabel="Will you train at least 2 days a week"
            />
          </>
        );
      }
      case 'lifting':
        return (
          <>
            <StepHeader
              eyebrow={STEP_SECTION.lifting}
              title="How long have you been strength training regularly?"
              helper="Count only time when you trained at least twice a week. Coming back after a long break? Choose ‘Less than 1 year’."
            />
            <ChoiceList options={LIFTING_OPTIONS} value={draft.lifting_experience} onChange={(v) => update({ lifting_experience: v })} accessibilityLabel="Lifting experience" />
          </>
        );
      case 'target':
        return <TargetStep draft={draft} update={update} />;
      case 'pace':
        return <PaceStep draft={draft} update={update} preview={pacePreview} today={today} />;
      case 'food':
        return <FoodStep draft={draft} update={update} />;
    }
  };

  const canContinue =
    current === 'consent' ? consented : current === 'change' ? changeChoice.length > 0 : current ? stepComplete(current, sanitize(draft), today) : false;
  const nextLabel = busy
    ? 'One moment…'
    : current === 'willTrain' && draft.will_train === false && isMuscleGoal(draft.goal)
      ? `Continue with ${goalLabel(untrainedGoal(draft.goal))}`
      : isLast
        ? 'See my plan'
        : 'Next';

  let body: ReactNode = null;
  let footer: ReactNode = null;
  switch (phase.kind) {
    case 'loading':
      body = <ActivityIndicator color={colors.brandPrimary} style={styles.loading} accessibilityLabel="Loading your answers" />;
      break;
    case 'loadError':
      body = (
        <View style={styles.loadError}>
          <Text style={styles.loadErrorText}>Couldn’t load your answers. {phase.message}</Text>
        </View>
      );
      footer = (
        <Button
          label="Try again"
          onPress={() => {
            setPhase({ kind: 'loading' });
            setLoadAttempt((n) => n + 1);
          }}
        />
      );
      break;
    case 'question':
      body = current ? renderStep(current) : null;
      footer = (
        <>
          <Button label={nextLabel} onPress={goNext} disabled={!canContinue || busy} />
          {current === 'food' ? (
            <Button
              label="Skip"
              variant="ghost"
              disabled={busy}
              onPress={() => {
                // Skipping leaves the food answers at their defaults.
                void advance({ ...draft, eating_style: null, religious_fasting: false, allergies: [], meals_per_day: MEALS.default });
              }}
            />
          ) : null}
        </>
      );
      break;
    case 'gate': {
      const choices = gateChoices(phase.gate, draft.goal);
      body = <GateScreen gate={phase.gate} goal={draft.goal} />;
      footer = (
        <>
          {choices.map((g, i) => (
            <Button key={g} label={`Continue with ${goalLabel(g)}`} variant={i === 0 ? 'primary' : 'secondary'} disabled={busy} onPress={() => void chooseGoal(g)} />
          ))}
          <Button label="Back" variant={choices.length ? 'ghost' : 'secondary'} onPress={goBack} />
        </>
      );
      break;
    }
    case 'stop':
      body = <StopScreen stop={phase.stop} />;
      footer = <Button label="Back to Nora" onPress={onClose} />;
      break;
    case 'review':
      body = <ReviewScreen plan={phase.plan} units={draft.units ?? 'metric'} />;
      footer = (
        <>
          <Button label={busy ? 'One moment…' : 'Use this plan'} onPress={() => void acceptPlan()} disabled={busy} />
          <Button label="Change my answers" variant="secondary" onPress={changeAnswers} disabled={busy} />
        </>
      );
      break;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: 10 + insets.top }]}>
        {canGoBack ? (
          <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={6} style={styles.iconButton}>
            <ChevronLeftIcon size={20} color={colors.textPrimary} strokeWidth={2.6} />
          </Pressable>
        ) : (
          <View style={styles.iconButton} />
        )}
        {phase.kind === 'question' || phase.kind === 'review' ? (
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityLabel="Progress"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
            <LinearGradient
              colors={colors.gradPrimary}
              start={gradientAngle.start}
              end={gradientAngle.end}
              style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]}
            />
          </View>
        ) : (
          <View style={styles.progressSpacer} />
        )}
        <Pressable onPress={phase.kind === 'stop' ? onClose : requestClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={6} style={styles.iconButton}>
          <CloseIcon size={16} color={colors.textPrimary} strokeWidth={2.6} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          key={phase.kind === 'question' ? current : phase.kind}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

/** The goal to offer instead of a muscle goal when the user won't strength train. */
function untrainedGoal(goal: NutritionGoalKind | undefined): NutritionGoalKind {
  return goal === 'recomp' ? 'lose_fat' : 'maintain';
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgApp },
    flex: { flex: 1 },
    topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingBottom: 10 },
    iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    progressTrack: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.trackEmpty, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: radius.pill },
    progressSpacer: { flex: 1 },
    content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
    footer: {
      gap: spacing.sm,
      paddingTop: spacing.md,
      paddingHorizontal: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
      backgroundColor: colors.bgSurface,
    },
    error: { fontFamily: fontFamily.semibold, fontSize: fontSize.small, color: colors.errorText, textAlign: 'center' },
    loading: { marginTop: spacing.xxxl },
    loadError: { paddingTop: spacing.xxxl, alignItems: 'center' },
    loadErrorText: { fontFamily: fontFamily.medium, fontSize: fontSize.body, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' },
    consentCard: {
      gap: spacing.md,
      padding: 18,
      marginBottom: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.bgSurfaceSolid,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    consentText: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 20, color: colors.textSecondary },
    link: { color: colors.brandPrimary, fontFamily: fontFamily.bold },
    gap: { marginTop: spacing.md },
  });
