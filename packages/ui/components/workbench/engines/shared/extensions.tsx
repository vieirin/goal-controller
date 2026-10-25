'use client';

import { nextRtId } from '@/lib/workbench/pistar';
import { GUARD_REJECTION_CODE } from '@/lib/workbench/guardDiagnostics';
import { isActorIn, metamodelOf } from '@istar-ts/core';
import type { ActionPostGuard } from '@istar-ts/actions';
import type { IstarExtension } from '@istar-ts/react';

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
 * The engines read an RT id at the start of each name ("G3: …"): new elements get the
 * next free one. Qualities are goals to the engines, so they share the G numbering.
 */
export const rtNumbering: IstarExtension = {
  name: 'rt-numbering',
  elements: {
    'istar.Goal': {
      defaultName: ({ model }) => `${nextRtId(model, 'istar.Goal')}: Goal`,
    },
    'istar.Quality': {
      defaultName: ({ model }) =>
        `${nextRtId(model, 'istar.Quality')}: Quality`,
    },
    'istar.Task': {
      defaultName: ({ model }) => `${nextRtId(model, 'istar.Task')}: Task`,
    },
    'istar.Resource': {
      defaultName: ({ model }) =>
        `${nextRtId(model, 'istar.Resource')}: Resource`,
    },
  },
};
