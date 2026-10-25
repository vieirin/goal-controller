import type { GoalDiagnostic } from '@istar-ts/core';

/**
 * Tags a diagnostic one of goal-controller's own guards raised (oneActorOnly,
 * pistarExtMetamodelGuard): `dispatchOrFallback` (goal-controller#439 review)
 * tells these apart from the vocabulary's own rejections (an unknown kind, a
 * bad property) to decide whether raw text can fall back to a quiet
 * `store.replace` — a guard's rejection never can, or it would be bypassed
 * entirely.
 */
export const GUARD_REJECTION_CODE = 'goal-controller/guard';

export const isGuardRejection = (
  diagnostics: readonly GoalDiagnostic[],
): boolean => diagnostics.some((d) => d.code === GUARD_REJECTION_CODE);
