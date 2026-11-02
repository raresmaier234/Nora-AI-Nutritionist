import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Palette, fontFamily, fontSize, spacing, trackWide, useStyles } from '@/theme';
import { ALLERGEN_OPTIONS, EATING_STYLE_OPTIONS, MONTHS, Option, PACE_LABELS, goalLabel } from '@/features/nutrition-plan/options';
import {
  DAYS,
  Draft,
  MEALS,
  birthProblem,
  cmToFtIn,
  formatDate,
  formatRate,
  formatWeight,
  ftInToCm,
  parseIsoDate,
  heightOk,
  isMuscleGoal,
  kgToLb,
  lbToKg,
  targetIsHighForHeight,
  targetProblem,
  targetRange,
  weightOk,
} from '@/features/nutrition-plan/questionnaire';
import type { MeasurementUnits, PaceOption, PlanPreview } from '@/services/api';

import { DateField } from './date-field';
import { Callout, ChipGroup, ChoiceRow, NumberField, StepHeader, Stepper, UnitToggle, parseNumber } from './parts';

/*
 * The questionnaire screens that keep something of their own while open — typed text, a unit
 * toggle, a choice that isn't an answer yet. Every change goes straight into the answers
 * (`update`); a value that can't be used yet is left out, which keeps Next disabled.
 */

export type StepProps = { draft: Draft; update: (patch: Draft) => void };

const oneDecimal = (n: number) => String(Math.round(n * 10) / 10);
const HEIGHT_UNITS: Option<MeasurementUnits>[] = [
  { value: 'metric', label: 'cm' },
  { value: 'imperial', label: 'ft, in' },
];
const WEIGHT_UNITS: Option<MeasurementUnits>[] = [
  { value: 'metric', label: 'kg' },
  { value: 'imperial', label: 'lb' },
];
/** A weight in the user's units, for a text field. */
const weightText = (kg: number | null | undefined, units: MeasurementUnits) =>
  kg == null ? '' : units === 'imperial' ? oneDecimal(kgToLb(kg)) : oneDecimal(kg);
/** A typed weight in the user's units, to kg (0.1); null if it isn't a number. */
const typedKg = (text: string, units: MeasurementUnits) => {
  const n = parseNumber(text);
  if (n === null) return null;
  return units === 'imperial' ? lbToKg(n) : Math.round(n * 10) / 10;
};

// ---- Q2 Birth ------------------------------------------------------------------------------

export function BirthStep({ draft, update, today }: StepProps & { today: Date }) {
  const styles = useStyles(makeStyles);
  const [year, setYear] = useState(draft.birth_year ? String(draft.birth_year) : '');
  const problem = birthProblem(draft, today);
  return (
    <>
      <StepHeader eyebrow="About you" title="When were you born?" helper="Your age shapes your energy needs, and what’s safe for you." />
      <Text style={styles.label}>Month</Text>
      <ChipGroup
        options={MONTHS.map((label, i) => ({ value: String(i + 1), label }))}
        isSelected={(v) => draft.birth_month === Number(v)}
        onPress={(v) => update({ birth_month: Number(v) })}
        columns={4}
        accessibilityLabel="Birth month"
      />
      <Text style={[styles.label, styles.labelGap]}>Year</Text>
      <NumberField
        value={year}
        onChangeText={(text) => {
          setYear(text);
          const n = parseNumber(text);
          update({ birth_year: n !== null && Number.isInteger(n) && text.trim().length === 4 ? n : undefined });
        }}
        unit=""
        placeholder="e.g. 1994"
        maxLength={4}
        accessibilityLabel="Birth year"
      />
      {problem ? (
        <View style={styles.gap}>
          <Callout tone="error">{problem}</Callout>
        </View>
      ) : null}
    </>
  );
}

// ---- Q4 Height -----------------------------------------------------------------------------

export function HeightStep({ draft, update }: StepProps) {
  const styles = useStyles(makeStyles);
  const units = draft.units ?? 'metric';
  const start = draft.height_cm ? cmToFtIn(draft.height_cm) : null;
  const [cm, setCm] = useState(draft.height_cm ? String(draft.height_cm) : '');
  const [ft, setFt] = useState(start ? String(start.ft) : '');
  const [inches, setInches] = useState(start ? String(start.inches) : '');

  const setUnits = (next: MeasurementUnits) => {
    if (draft.height_cm) {
      const fi = cmToFtIn(draft.height_cm);
      setCm(String(draft.height_cm));
      setFt(String(fi.ft));
      setInches(String(fi.inches));
    }
    update({ units: next });
  };
  const fromFtIn = (f: string, i: string) => {
    const nf = parseNumber(f);
    const ni = i.trim() === '' ? 0 : parseNumber(i);
    update({ height_cm: nf !== null && ni !== null && ni < 12 ? ftInToCm(nf, ni) : undefined });
  };
  const typed = units === 'metric' ? cm.trim() !== '' : ft.trim() !== '';

  return (
    <>
      <StepHeader eyebrow="About you" title="How tall are you?" />
      <UnitToggle options={HEIGHT_UNITS} value={units} onChange={setUnits} />
      {units === 'metric' ? (
        <NumberField
          value={cm}
          onChangeText={(text) => {
            setCm(text);
            const n = parseNumber(text);
            update({ height_cm: n !== null && Number.isInteger(n) ? n : undefined });
          }}
          unit="cm"
          placeholder="170"
          maxLength={3}
          accessibilityLabel="Height in centimetres"
        />
      ) : (
        <View style={styles.pair}>
          <View style={styles.pairItem}>
            <NumberField
              value={ft}
              onChangeText={(text) => {
                setFt(text);
                fromFtIn(text, inches);
              }}
              unit="ft"
              placeholder="5"
              maxLength={1}
              accessibilityLabel="Height, feet"
            />
          </View>
          <View style={styles.pairItem}>
            <NumberField
              value={inches}
              onChangeText={(text) => {
                setInches(text);
                fromFtIn(ft, text);
              }}
              unit="in"
              placeholder="7"
              maxLength={2}
              accessibilityLabel="Height, inches"
            />
          </View>
        </View>
      )}
      {typed && !heightOk(draft.height_cm) ? (
        <View style={styles.gap}>
          <Callout tone="error">
            {units === 'metric' ? 'Enter a height between 120 and 230 cm.' : 'Enter a height between 4 ft and 7 ft 6 in (inches under 12).'}
          </Callout>
        </View>
      ) : null}
    </>
  );
}

// ---- Q5 Weight -----------------------------------------------------------------------------

export function WeightStep({ draft, update }: StepProps) {
  const styles = useStyles(makeStyles);
  const units = draft.units ?? 'metric';
  const [text, setText] = useState(weightText(draft.weight_kg, units));

  const setUnits = (next: MeasurementUnits) => {
    setText(weightText(draft.weight_kg, next));
    update({ units: next });
  };

  return (
    <>
      <StepHeader
        eyebrow="About you"
        title="What do you weigh now?"
        helper="If you can, weigh yourself this morning: after the toilet, before eating or drinking."
      />
      <UnitToggle options={WEIGHT_UNITS} value={units} onChange={setUnits} />
      <NumberField
        value={text}
        onChangeText={(t) => {
          setText(t);
          update({ weight_kg: typedKg(t, units) ?? undefined });
        }}
        unit={units === 'imperial' ? 'lb' : 'kg'}
        placeholder={units === 'imperial' ? '160' : '72.5'}
        decimal
        accessibilityLabel={units === 'imperial' ? 'Weight in pounds' : 'Weight in kilograms'}
      />
      {text.trim() !== '' && !weightOk(draft.weight_kg) ? (
        <View style={styles.gap}>
          <Callout tone="error">{units === 'imperial' ? 'Enter a weight between 67 and 661 lb.' : 'Enter a weight between 30 and 300 kg.'}</Callout>
        </View>
      ) : null}
    </>
  );
}

// ---- Q8 Exercise ---------------------------------------------------------------------------

export function ExerciseStep({ draft, update }: StepProps) {
  const styles = useStyles(makeStyles);
  return (
    <>
      <StepHeader
        eyebrow="Activity"
        title="In a normal week, how many days do you do…"
        helper="Count a typical week from the last month, not your best week. Walking belongs in the previous question."
      />
      <View style={styles.list}>
        <Stepper
          label="Strength training"
          hint="Weights, machines or bodyweight"
          value={draft.strength_days ?? 0}
          min={DAYS.min}
          max={DAYS.max}
          unit="days"
          onChange={(n) => update({ strength_days: n })}
        />
        <Stepper
          label="Cardio or sport"
          hint="30 minutes or more"
          value={draft.cardio_days ?? 0}
          min={DAYS.min}
          max={DAYS.max}
          unit="days"
          onChange={(n) => update({ cardio_days: n })}
        />
      </View>
    </>
  );
}

// ---- Q10 Target ----------------------------------------------------------------------------

export function TargetStep({ draft, update }: StepProps) {
  const styles = useStyles(makeStyles);
  const units = draft.units ?? 'metric';
  const gain = draft.goal === 'build_muscle';
  // The muscle goals can go without a target ("No target" is the default).
  const optional = isMuscleGoal(draft.goal);
  const [text, setText] = useState(weightText(draft.target_weight_kg, units));
  const [wantsTarget, setWantsTarget] = useState(!optional || draft.target_weight_kg != null);
  const range = targetRange(draft);
  const problem = text.trim() !== '' || !optional ? targetProblem(draft) : null;
  const weight = draft.weight_kg;
  const bigLoss = !gain && weight && draft.target_weight_kg && (weight - draft.target_weight_kg) / weight > 0.15;
  const goal = draft.goal ? goalLabel(draft.goal) : '';
  // Gain muscle with a lower target: what they want is Lose fat and build muscle.
  const wantsToLose = gain && problem === 'not_above' && weight != null && draft.target_weight_kg != null && draft.target_weight_kg < weight;

  let message: string | null = null;
  if (range && problem === 'not_below') message = `For ${goal}, choose a weight below where you are now: ${formatWeight(range.max, units)} or less.`;
  if (range && problem === 'below_floor') message = `The lowest target we can set for you is ${formatWeight(range.min, units)}.`;
  if (range && problem === 'not_above' && !wantsToLose) message = `For ${goal}, choose a weight above where you are now (${formatWeight(range.min, units)} or more), or No target.`;
  if (range && problem === 'too_high') message = `Choose a target up to ${formatWeight(range.max, units)}.`;
  const placeholderKg = weight ? (gain ? weight + 3 : Math.max(weight - 5, range?.min ?? 0)) : null;

  const field = (
    <NumberField
      value={text}
      onChangeText={(t) => {
        setText(t);
        update({ target_weight_kg: typedKg(t, units) ?? undefined });
      }}
      unit={units === 'imperial' ? 'lb' : 'kg'}
      placeholder={placeholderKg ? weightText(placeholderKg, units) : ''}
      decimal
      accessibilityLabel={units === 'imperial' ? 'Target weight in pounds' : 'Target weight in kilograms'}
    />
  );

  return (
    <>
      <StepHeader
        eyebrow="Your goal"
        title="What weight would you like to reach?"
        helper={
          gain
            ? 'Optional. With no target, Nora plans a 16-week block, then asks what’s next.'
            : optional
              ? 'Optional. While you build muscle, the scale may move only a little, so you don’t need a target. With none, Nora plans a 16-week block, then asks what’s next.'
              : `You weigh ${weight ? formatWeight(weight, units) : '…'} now. Pick a weight that feels realistic; you can change it any time.`
        }
      />
      {optional ? (
        <View style={styles.list}>
          <ChoiceRow
            kind="radio"
            label={gain ? 'No target, just build steadily' : 'No target, just watch my body change'}
            selected={!wantsTarget}
            onPress={() => {
              setWantsTarget(false);
              update({ target_weight_kg: null });
            }}
          />
          <ChoiceRow
            kind="radio"
            label="I have a target weight"
            selected={wantsTarget}
            onPress={() => {
              setWantsTarget(true);
              update({ target_weight_kg: typedKg(text, units) ?? undefined });
            }}
          />
          {wantsTarget ? field : null}
        </View>
      ) : (
        field
      )}
      {message ? (
        <View style={styles.gap}>
          <Callout tone="error">{message}</Callout>
        </View>
      ) : null}
      {wantsToLose ? (
        <View style={styles.gap}>
          <Callout>
            Want to lose weight while you build muscle? That’s Lose fat and build muscle: a small deficit, with protein kept high to protect and build
            muscle while you train.
          </Callout>
          <Button label="Switch to Lose fat and build muscle" variant="secondary" onPress={() => update({ goal: 'recomp' })} style={styles.gap} />
        </View>
      ) : null}
      {!problem && targetIsHighForHeight(draft) ? (
        <View style={styles.gap}>
          <Callout tone="warning">That’s a big gain for your height. You can keep it, but a nearer first target may suit you better.</Callout>
        </View>
      ) : null}
      {!problem && bigLoss && weight ? (
        <View style={styles.gap}>
          <Callout>
            That’s a big change. Many people find a first milestone of about 10% ({formatWeight(weight * 0.9, units)}) easier to reach, then set the
            next one.
          </Callout>
        </View>
      ) : null}
    </>
  );
}

// ---- Q11 Pace ------------------------------------------------------------------------------

const PACE_ORDER = ['gentle', 'steady', 'faster'] as const;

/** Where the custom date starts: the saved one if it's in range, else Steady's date, else the earliest. */
function startDate(draft: Draft, preview: PlanPreview): string | null {
  const range = preview.custom_date_range;
  if (!range) return null;
  const clamp = (iso: string) => (iso < range.min ? range.min : iso > range.max ? range.max : iso);
  if (draft.target_date) return clamp(draft.target_date);
  const steady = preview.pace_options.find((o) => o.pace === 'steady');
  return clamp(steady?.goal_date ?? range.min);
}

export function PaceStep({ draft, update, preview, today }: StepProps & { preview: PlanPreview | null; today: Date }) {
  const styles = useStyles(makeStyles);
  const units = draft.units ?? 'metric';
  if (!preview) return null;
  const options = PACE_ORDER.map((p) => preview.pace_options.find((o) => o.pace === p && o.available)).filter((o): o is PaceOption => !!o);
  const range = preview.custom_date_range;
  const target = draft.target_weight_kg ?? null;
  // What the picked date asks for, a week. A date sooner than the fastest pace on offer
  // reaches is planned at that pace (the API's clamp), so it gets that pace's date: say so now.
  const customRate =
    draft.pace === 'custom' && draft.target_date && target !== null && draft.weight_kg
      ? Math.abs(draft.weight_kg - target) / Math.max(1, (parseIsoDate(draft.target_date).getTime() - today.getTime()) / (7 * 24 * 3600 * 1000))
      : null;
  const fastest = options
    .filter((o) => o.goal_date)
    .reduce<PaceOption | null>((best, o) => (!best || o.effective_rate_kg_week > best.effective_rate_kg_week ? o : best), null);
  // Rates show to 0.05 kg: only a clear difference counts as too soon.
  const tooSoon = customRate !== null && fastest !== null && customRate > fastest.effective_rate_kg_week + 0.025;

  const describe = (o: PaceOption) => {
    if (!o.goal_date || !o.weeks) return 'Too close to your usual intake to make a real change at this pace';
    const when = target !== null ? `Reach ${formatWeight(target, units)} around ${formatDate(o.goal_date)}` : `A ${o.weeks}-week block, until ${formatDate(o.goal_date)}`;
    return `${formatRate(o.effective_rate_kg_week, units)} · ${when} (~${o.weeks} weeks)`;
  };

  return (
    <>
      <StepHeader
        eyebrow="Your goal"
        title="How fast would you like to go?"
        helper="Each pace shows what you can expect to lose or gain a week, and when you’d get there. Slower is easier to keep up."
      />
      <View style={styles.list}>
        {options.map((o) => (
          <ChoiceRow
            key={o.pace}
            kind="radio"
            label={o.pace === 'steady' ? `${PACE_LABELS[o.pace]} (recommended)` : PACE_LABELS[o.pace]}
            description={describe(o)}
            selected={draft.pace === o.pace}
            onPress={() => update({ pace: o.pace, target_date: null })}
          />
        ))}
        {range ? (
          <ChoiceRow
            kind="radio"
            label="I have a date in mind"
            description="Pick when you’d like to get there"
            selected={draft.pace === 'custom'}
            onPress={() => update({ pace: 'custom', target_date: startDate(draft, preview) })}
          />
        ) : null}
        {range && draft.pace === 'custom' && draft.target_date ? (
          <>
            <DateField label="Reach my goal by" value={draft.target_date} min={range.min} max={range.max} onChange={(d) => update({ target_date: d })} />
            {tooSoon && fastest?.goal_date && target !== null ? (
              <Callout tone="warning">
                {`${formatDate(draft.target_date)} would need ${formatRate(customRate!, units)}`}
                {draft.goal === 'recomp'
                  ? `. Lose fat and build muscle goes up to ${formatRate(fastest.effective_rate_kg_week, units)}, so the deficit stays small enough to build muscle: `
                  : draft.goal === 'build_muscle'
                    ? `, faster than Nora plans for you. At ${formatRate(fastest.effective_rate_kg_week, units)}, the fastest it plans, `
                    : `, faster than is safe for you. At the fastest safe pace, ${formatRate(fastest.effective_rate_kg_week, units)}, `}
                {`you’d reach ${formatWeight(target, units)} around ${formatDate(fastest.goal_date)}. Your plan will use that date.`}
              </Callout>
            ) : customRate !== null && target !== null ? (
              <Text style={styles.note}>{`That works out at ${formatRate(customRate, units)}: you’d reach ${formatWeight(target, units)} on ${formatDate(draft.target_date)}.`}</Text>
            ) : null}
          </>
        ) : null}
      </View>
      {options.length === 0 && !range ? (
        <View style={styles.gap}>
          <Callout tone="error">Nora couldn’t work out a pace from these answers. Go back and check your target.</Callout>
        </View>
      ) : null}
      {preview.notices.map((n) => (
        <View key={n.code} style={styles.gap}>
          <Callout>{n.message}</Callout>
        </View>
      ))}
    </>
  );
}

// ---- Q12 Food ------------------------------------------------------------------------------

export function FoodStep({ draft, update }: StepProps) {
  const styles = useStyles(makeStyles);
  const allergies = draft.allergies ?? [];
  return (
    <>
      <StepHeader
        eyebrow="Food"
        title="Anything we should know about how you eat?"
        helper="Optional. It shapes the tips in your plan, not your numbers."
      />
      <Text style={styles.label}>How you eat</Text>
      <ChipGroup
        options={EATING_STYLE_OPTIONS}
        isSelected={(v) => draft.eating_style === v}
        onPress={(v) => update({ eating_style: draft.eating_style === v ? null : v })}
        accessibilityLabel="How you eat"
      />
      <View style={styles.gap}>
        <ChoiceRow
          kind="checkbox"
          label="I follow religious fasting periods"
          description="For example, Orthodox fasts or Ramadan"
          selected={!!draft.religious_fasting}
          onPress={() => update({ religious_fasting: !draft.religious_fasting })}
        />
      </View>
      <Text style={[styles.label, styles.labelGap]}>Allergies and intolerances</Text>
      <ChipGroup
        options={ALLERGEN_OPTIONS}
        isSelected={(v) => allergies.includes(v)}
        onPress={(v) => update({ allergies: allergies.includes(v) ? allergies.filter((a) => a !== v) : [...allergies, v] })}
        accessibilityLabel="Allergies and intolerances"
      />
      <View style={[styles.gap, styles.labelGap]}>
        <Stepper
          label="Meals a day"
          hint="Including snacks you’d call a meal"
          value={draft.meals_per_day ?? MEALS.default}
          min={MEALS.min}
          max={MEALS.max}
          unit="meals"
          onChange={(n) => update({ meals_per_day: n })}
        />
      </View>
    </>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    label: {
      fontFamily: fontFamily.bold,
      fontSize: fontSize.micro,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: trackWide(fontSize.micro),
      marginBottom: spacing.sm + 2,
    },
    labelGap: { marginTop: spacing.xl },
    gap: { marginTop: spacing.md },
    list: { gap: 10 },
    pair: { flexDirection: 'row', gap: spacing.md },
    pairItem: { flex: 1 },
    note: { fontFamily: fontFamily.medium, fontSize: fontSize.small, lineHeight: 19, color: colors.textTertiary, paddingHorizontal: spacing.xs },
  });
