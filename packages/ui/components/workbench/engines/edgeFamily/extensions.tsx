'use client';

import { ENGINE_DIALECTS } from '@/lib/workbench/definitions';
import { firstResourceIssue } from '@/lib/workbench/edgeProperties';
import { isActor } from '@istar-ts/core';
import {
  elementIcon,
  type ElementComponentProps,
  type IstarExtension,
} from '@istar-ts/react';
import type { ReactElement } from 'react';
import { ElementWithProblems } from '../shared/extensions';
import type { RejectEdit } from '../shared/WorkbenchCanvas';

/**
 * What Edge and EdgeV2 share in the diagram: they read the same elements and keys (see
 * packages/lib/src/engines/edgeFamily/checks.ts), so each declares its extensions from these.
 */

/** What an Edge resource variable is, for its badge: "bool = true", "int 0..5 = 5"; issue from the shared engine check. */
const resourceVariable = (
  properties: Readonly<Record<string, string>> | undefined,
): { label: string; issue: string | null } => {
  const { type, initialValue, lowerBound, upperBound } = properties ?? {};
  const label =
    type === 'bool'
      ? `bool = ${initialValue ?? '?'}`
      : type === 'int'
        ? `int ${lowerBound ?? '?'}..${upperBound ?? '?'} = ${initialValue ?? '?'}`
        : type
          ? `${type}?`
          : 'no type';
  return { label, issue: firstResourceIssue(properties ?? {}) };
};

/**
 * Edge resources are variables: drawn yellow unless they have a colour of their own (nothing
 * is written to the file), with a badge at the bottom showing the type and initial value.
 */
function EdgeResource(props: ElementComponentProps): ReactElement {
  const element = props.element.display?.backgroundColor
    ? props.element
    : {
        ...props.element,
        display: {
          ...props.element.display,
          // the Edge definitions share their resource fill
          backgroundColor: ENGINE_DIALECTS.edge.elements.resource.fill,
        },
      };
  const { label, issue } = resourceVariable(props.element.customProperties);
  return (
    <div className='relative h-full w-full'>
      <ElementWithProblems {...props} element={element} />
      <span
        className={`pointer-events-none absolute -bottom-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border bg-white px-1.5 font-mono text-[10px] leading-4 ${issue ? 'border-danger text-danger' : 'border-ink-muted text-ink-soft'}`}
        title={issue ? `${label}: ${issue}` : label}
      >
        {label}
      </span>
    </div>
  );
}

/** The Resource palette icon with a bubble below it naming the variable type, like the badge on resources. */
function ResourceToolIcon({ type }: { type: 'bool' | 'int' }): ReactElement {
  return (
    <span className='relative inline-flex flex-col items-center'>
      {elementIcon('istar.Resource')}
      <span className='-mt-2 rounded-full border border-ink-muted bg-white px-1 font-mono text-[9px] leading-3 text-ink-soft'>
        {type}
      </span>
    </span>
  );
}

/**
 * Edge and EdgeV2 read goals, tasks and resources in an actor, linked by And/Or
 * refinement and Needed-By: the palette offers only those (other kinds fail to convert).
 */
export const edgePalette: IstarExtension = {
  name: 'edge-palette',
  elements: {
    // Actor alone: no Actor/Agent/Role dropdown
    'istar.Actor': { palette: { group: undefined } },
    'istar.Agent': { palette: false },
    'istar.Role': { palette: false },
    'istar.Quality': { palette: false },
    // resources are the engine's variables: one tool per type, with valid properties preset
    // after Task (default order 36): Goal, Task, then Resource
    'istar.Resource': {
      component: EdgeResource,
      palette: [
        {
          label: 'Boolean',
          title: 'Boolean resource: click on an actor to add it (starts true)',
          icon: <ResourceToolIcon type='bool' />,
          group: 'resource',
          order: 37,
          properties: { type: 'bool', initialValue: 'true' },
        },
        {
          label: 'Integer',
          title:
            'Integer resource: click on an actor to add it (0 to 5, starts at 5)',
          icon: <ResourceToolIcon type='int' />,
          group: 'resource',
          order: 37,
          properties: {
            type: 'int',
            initialValue: '5',
            lowerBound: '0',
            upperBound: '5',
          },
        },
      ],
    },
  },
  paletteGroups: {
    resource: { label: 'Resource', title: 'Add a Boolean or Integer resource' },
  },
  links: {
    'istar.IsALink': { palette: false },
    'istar.ParticipatesInLink': { palette: false },
    'istar.DependencyLink': { palette: false },
    'istar.ContributionLink': { palette: false },
    'istar.QualificationLink': { palette: false },
  },
};

/** The Edge engines build one goal tree from one actor: a second actor is taken back out. */
export const oneActorOnly: RejectEdit = (event) =>
  event.changes.some(
    (change) =>
      change.type === 'addElement' &&
      isActor(event.model.elements.get(change.id)),
  ) && [...event.model.elements.values()].filter(isActor).length > 1
    ? 'The Edge engines read a single actor: add goals, tasks and resources inside the existing one.'
    : null;
