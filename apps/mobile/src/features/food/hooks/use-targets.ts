import { useAuth } from '@/features/auth';
import { TARGETS, Targets } from '@/features/food/data/mock-data';

/** The signed-in user's daily targets, from their profile; the defaults until it has loaded. */
export function useTargets(): Targets {
  const targets = useAuth().profile?.targets;
  if (!targets) return TARGETS;
  return { kcal: targets.kcal, protein: targets.protein_g, carbs: targets.carbs_g, fat: targets.fat_g, fiber: targets.fiber_g };
}
