'use client';

import { nextRtId } from '@/lib/workbench/pistar';
import { isActorIn, isActorKindIn, metamodelOf } from '@istar-ts/core';
import type { ActionGuard } from '@istar-ts/actions';
import type { IstarExtension } from '@istar-ts/react';

/**
 * An engine that reads one actor: a second one is rejected before it is
 * added, saying so (goal-controller#412: a dispatcher guard, not a post-hoc
 * undo).
 */
export const oneActorOnly =
  (message: string): ActionGuard<string, string> =>
  (operation, model) => {
    if (operation.kind !== 'createNode') return;
    const metamodel = metamodelOf(model);
    if (!isActorKindIn(metamodel, operation.elementTypeId)) return;
    if ([...model.elements.values()].some(isActorIn(metamodel)))
      return [{ elementId: '', severity: 'error', message, source: 'shield' }];
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
