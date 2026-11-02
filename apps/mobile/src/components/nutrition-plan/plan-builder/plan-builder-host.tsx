import { ReactNode, createContext, use, useEffect, useState } from 'react';

import { FirstPlanPrompt } from '@/components/nutrition-plan/first-plan-prompt';
import { useAuth } from '@/features/auth';
import { rememberPlanPromptAnswered, wasPlanPromptAnswered } from '@/features/nutrition-plan/plan-prompt';

import { PlanBuilder, PlanBuilderRequest } from './plan-builder';

type PlanBuilderContextValue = {
  /** Opens the plan questionnaire. */
  open: (request: PlanBuilderRequest) => void;
  /** Goes up whenever a plan is activated or a stop recorded: the Profile tab reloads its plan. */
  version: number;
};

const PlanBuilderContext = createContext<PlanBuilderContextValue | null>(null);

/** Opens the plan builder from any tab. Needs <PlanBuilderHost> above (src/app/(tabs)/_layout.tsx). */
export function usePlanBuilder(): PlanBuilderContextValue {
  const value = use(PlanBuilderContext);
  if (!value) throw new Error('usePlanBuilder() must be used inside <PlanBuilderHost>.');
  return value;
}

/**
 * Owns the plan builder — one full-screen modal over the tabs, opened from the Profile tab or
 * from the "Build my plan" prompt a premium user gets once after first signing in (no plan yet,
 * and not logging without targets). "Not now" is remembered per user on this phone.
 */
export function PlanBuilderHost({ children }: { children: ReactNode }) {
  const { user, profile, reloadProfile } = useAuth();
  const userId = user?.id ?? null;
  const [request, setRequest] = useState<(PlanBuilderRequest & { key: number }) | null>(null);
  const [version, setVersion] = useState(0);
  /** Whether this user still gets the first prompt, once read from storage. */
  const [prompt, setPrompt] = useState<{ userId: string; show: boolean } | null>(null);
  const [buildAfterPrompt, setBuildAfterPrompt] = useState(false);

  const eligible = !!profile && profile.id === userId && profile.plan === 'premium' && profile.targets_mode === 'default';
  useEffect(() => {
    if (!eligible || !userId) return;
    let cancelled = false;
    wasPlanPromptAnswered(userId).then((answered) => {
      if (!cancelled) setPrompt({ userId, show: !answered });
    });
    return () => {
      cancelled = true;
    };
  }, [eligible, userId]);

  const open = (next: PlanBuilderRequest) => setRequest({ ...next, key: Date.now() });

  const answerPrompt = (build: boolean) => {
    if (userId) void rememberPlanPromptAnswered(userId);
    setPrompt((p) => (p ? { ...p, show: false } : p));
    setBuildAfterPrompt(build);
  };

  return (
    <PlanBuilderContext value={{ open, version }}>
      {children}
      <PlanBuilder
        request={request}
        onClose={() => setRequest(null)}
        onActivated={() => {
          reloadProfile();
          setVersion((v) => v + 1);
          setRequest(null);
        }}
        onStopped={() => {
          reloadProfile();
          setVersion((v) => v + 1);
        }}
      />
      <FirstPlanPrompt
        visible={eligible && request === null && prompt?.userId === userId && prompt.show}
        onBuild={() => answerPrompt(true)}
        onNotNow={() => answerPrompt(false)}
        onDismissed={() => {
          // The builder can only be presented once the sheet has fully closed.
          if (!buildAfterPrompt) return;
          setBuildAfterPrompt(false);
          open({ mode: 'build' });
        }}
      />
    </PlanBuilderContext>
  );
}
