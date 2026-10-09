'use client';

import { nextRtId } from '@/lib/workbench/pistar';
import { isActor } from '@istar-ts/core';
import type { IstarExtension } from '@istar-ts/react';
import type { RejectEdit } from './WorkbenchCanvas';

/** An engine that reads one actor: a second one is taken back out, saying so. */
export const oneActorOnly =
  (message: string): RejectEdit =>
  (event) =>
    event.changes.some(
      (change) =>
        change.type === 'addElement' &&
        isActor(event.model.elements.get(change.id)),
    ) && [...event.model.elements.values()].filter(isActor).length > 1
      ? message
      : null;

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
