'use client';

import { ENGINE_DIALECTS } from '@/lib/workbench/engineDialects';
import { nextRtId } from '@/lib/workbench/pistar';
import type { ElementComponentProps, IstarExtension } from '@istar-ts/react';
import type { ReactElement } from 'react';
import {
  ElementWithProblems,
  oneActorOnly,
  problemBadges,
} from '../shared/extensions';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

const { mutrose } = ENGINE_DIALECTS;

/**
 * A goal's fill by its GoalType, as mutrose-vscode's istar-ts editor draws it
 * (a Perform goal keeps the definition's). The definition gives one fill per
 * kind: one that follows a property is drawn here.
 */
const GOAL_TYPE_FILL: Readonly<Record<string, string>> = {
  Achieve: '#86efac',
  Query: '#fdba74',
};

/** A goal's palette icon in its GoalType's fill, as the diagram draws it. */
function GoalToolIcon({ fill }: { fill: string }): ReactElement {
  return (
    <svg width='34' height='18' viewBox='0 0 34 18' aria-hidden>
      <rect
        x='1'
        y='1'
        width='32'
        height='16'
        rx='8'
        fill={fill}
        stroke='currentColor'
        strokeWidth='1.5'
      />
    </svg>
  );
}

/** Goal: one tool per GoalType, each presetting it (the mutrose-vscode editor's choice). */
const GOAL_TOOLS = (['Perform', 'Achieve', 'Query'] as const).map((type) => ({
  label: type,
  title: `${type} goal: click on the mission to add it`,
  icon: (
    <GoalToolIcon fill={GOAL_TYPE_FILL[type] ?? mutrose.elements.goal.fill} />
  ),
  group: 'goal',
  properties: { GoalType: type },
}));

function MutroseGoal(props: ElementComponentProps): ReactElement {
  const fill = GOAL_TYPE_FILL[props.element.customProperties?.GoalType ?? ''];
  const element =
    fill && !props.element.display?.backgroundColor
      ? {
          ...props.element,
          display: { ...props.element.display, backgroundColor: fill },
        }
      : props.element;
  return <ElementWithProblems {...props} element={element} />;
}

/**
 * MutRoSe reads goals `G1` and abstract tasks `AT1` in one actor, refined by
 * AND/OR links: the palette offers only those, and new ones are numbered so.
 */
const mutrosePalette: IstarExtension = {
  name: 'mutrose-palette',
  elements: {
    'istar.Actor': { palette: { group: undefined } },
    'istar.Agent': { palette: false },
    'istar.Role': { palette: false },
    'istar.Quality': { palette: false },
    'istar.Resource': { palette: false },
    'istar.Goal': {
      component: MutroseGoal,
      palette: GOAL_TOOLS,
      defaultName: ({ model }) => `${nextRtId(model, 'istar.Goal')}: Goal`,
    },
    'istar.Task': {
      defaultName: ({ model }) =>
        `${nextRtId(model, 'istar.Task', mutrose.elements.task.prefix)}: Task`,
    },
  },
  paletteGroups: {
    goal: { label: 'Goal', title: 'Add a Perform, Achieve or Query goal' },
  },
  links: {
    'istar.IsALink': { palette: false },
    'istar.ParticipatesInLink': { palette: false },
    'istar.DependencyLink': { palette: false },
    'istar.ContributionLink': { palette: false },
    'istar.NeededByLink': { palette: false },
    'istar.QualificationLink': { palette: false },
  },
};

const MUTROSE_EXTENSIONS: readonly IstarExtension[] = [
  problemBadges,
  mutrosePalette,
];

/** What piStar mode's palette toggle adds for a file recorded for MutRoSe. */
export const MUTROSE_PALETTE: readonly IstarExtension[] = [mutrosePalette];

const mutroseOneActor = oneActorOnly(
  'MutRoSe reads a single actor (its mission): add goals and tasks inside the existing one.',
);

export default function MutroseDiagram() {
  return (
    <WorkbenchCanvas
      extensions={MUTROSE_EXTENSIONS}
      rejectEdit={mutroseOneActor}
    />
  );
}
