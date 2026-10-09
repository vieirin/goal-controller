'use client';

import { nextRtId } from '@/lib/workbench/pistar';
import { isActor } from '@istar-ts/core';
import type { Severity } from '@/lib/workbench/types';
import {
  DefaultElementComponent,
  type ElementComponentProps,
  type IstarExtension,
} from '@istar-ts/react';
import { createContext, useContext, type ReactElement } from 'react';
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

/** Worst problem severity per piStar id, for the badges on elements. */
export const SeverityContext = createContext<ReadonlyMap<string, Severity>>(
  new Map(),
);

export function ElementWithProblems(
  props: ElementComponentProps,
): ReactElement {
  const severity = useContext(SeverityContext).get(props.element.id);
  return (
    <div className='relative h-full w-full'>
      <DefaultElementComponent {...props} />
      {severity && (
        <span
          className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-[1.5px] border-white ${severity === 'error' ? 'bg-danger' : 'bg-caution'}`}
          title={
            severity === 'error'
              ? 'Has errors — see Problems'
              : 'Has warnings — see Problems'
          }
        />
      )}
    </div>
  );
}

export const problemBadges: IstarExtension = {
  name: 'problem-badges',
  elements: {
    'istar.Goal': { component: ElementWithProblems },
    'istar.Task': { component: ElementWithProblems },
    'istar.Resource': { component: ElementWithProblems },
    'istar.Quality': { component: ElementWithProblems },
  },
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
