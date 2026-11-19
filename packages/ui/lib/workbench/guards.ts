/**
 * The guards engines' editing rules are made of (goal-controller#412): plain
 * TypeScript with no React in reach, and no engine named, so the registry
 * (engineDialects.ts) can state each engine's rules with its other parts and
 * the model worker build them (modeGuards.ts).
 */
import type { ActionPostGuard } from '@istar-ts/actions';
import { isActorIn, metamodelOf } from '@istar-ts/core';
import { firstResourceIssue } from '@goal-controller/lib';
import { GUARD_REJECTION_CODE } from './guardDiagnostics';

/**
 * An engine that reads one actor: a second one is rejected, saying so
 * (goal-controller#412). A postGuard on the resulting model's own actor
 * count, not a pre-guard gated on `createNode` (goal-controller#439 review):
 * `istar.replaceModel` (a SourceView paste) and a compound's children reach
 * this the same way `createNode` does, so a second actor can't get in
 * through any of them.
 */
export const oneActorOnly =
  (message: string): ActionPostGuard<string, string> =>
  (_operation, modelAfter) => {
    const metamodel = metamodelOf(modelAfter);
    const actors = [...modelAfter.elements.values()].filter(
      isActorIn(metamodel),
    );
    if (actors.length > 1)
      return [
        {
          elementId: '',
          severity: 'error',
          message,
          source: 'shield',
          code: GUARD_REJECTION_CODE,
        },
      ];
  };

/**
 * A resource's bounds (goal-controller#412): today only a badge (`resourceVariable`,
 * engines/edgeFamily/extensions.tsx) and, at transform time, the mapper throwing it
 * into `[INVALID RESOURCE]` (packages/lib/src/engines/edgeFamily/checks.ts,
 * `firstResourceIssue`). Reads one element's own properties, no tree and no PRISM
 * generation, so it is cheap enough to run on every `istar.updateProperties`: the
 * "P9 shield" for edgeV2 (#408), wired to edgeV2 only (its rules, in the registry), per
 * the migration plan; its diagnostics' source is the engine's id.
 *
 * A warning, never an error (goal-controller#439 review): the Inspector dispatches one
 * property key per edit, so an `int` resource's `initialValue`/`lowerBound`/`upperBound`
 * only ever reach a valid combination one field at a time — every intermediate state
 * would otherwise be rejected, and a bool→int switch could never be completed through
 * that UI at all. The edit applies; the issue is returned with the result and still
 * shown (the badge, from the same check, independent of this guard).
 */
export const resourceBoundsGuard =
  (source: string): ActionPostGuard<string, string> =>
  (operation, modelAfter) => {
    if (operation.kind !== 'istar.updateProperties') return;
    const element = modelAfter.elements.get(operation.elementId);
    if (!element || element.kind !== 'istar.Resource') return;
    const issue = firstResourceIssue(element.customProperties ?? {});
    if (!issue) return;
    return [
      {
        elementId: operation.elementId,
        severity: 'warning',
        message: issue,
        source,
      },
    ];
  };
