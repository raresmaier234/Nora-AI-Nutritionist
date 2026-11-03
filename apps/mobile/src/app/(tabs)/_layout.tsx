import AppTabs from '@/components/navigation/app-tabs';
import { PlanBuilderHost } from '@/components/nutrition-plan/plan-builder/plan-builder-host';

/** The tabs, with the plan builder over them (opened from Strategy, or the first-sign-in prompt). */
export default function TabsLayout() {
  return (
    <PlanBuilderHost>
      <AppTabs />
    </PlanBuilderHost>
  );
}
