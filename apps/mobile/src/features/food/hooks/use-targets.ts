import { useAuth } from '@/features/auth';
import type { Targets } from '@/features/food/data/mock-data';

/**
 * The signed-in user's daily targets, from their profile — or null when there are none to show:
 * "log without targets" (`targets_mode: 'none'`, for people a calorie plan isn't safe for), and
 * while the profile loads (so nobody in that group ever sees a target flash by). Every screen
 * that shows targets must handle null: no target bars, "remaining", "% of goal" or goal rings —
 * plain totals instead.
 */
export function useTargets(): Targets | null {
  const profile = useAuth().profile;
  const targets = profile?.targets;
  if (!profile || profile.targets_mode === 'none' || !targets) return null;
  return { kcal: targets.kcal, protein: targets.protein_g, carbs: targets.carbs_g, fat: targets.fat_g, fiber: targets.fiber_g };
}
