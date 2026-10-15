'use client';

import { ENGINE_DIALECTS } from '@/lib/workbench/engineDialects';
import { nextRtId } from '@/lib/workbench/pistar';
import { fillOf } from '@goal-controller/dialect';
import {
  DefaultElementComponent,
  type ElementComponentProps,
  type IstarExtension,
} from '@istar-ts/react';
import type { ReactElement } from 'react';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

const { istardt } = ENGINE_DIALECTS;

/** iStarDT-V's non-attaining effect: pink, where an attaining one is green. */
const NOT_SATISFYING_FILL = '#F8DADA';

/**
 * An extension element drawn in its kind's colour (the dialect's fill),
 * unless a colour is saved; an effect green when it satisfies its task, pink
 * when it doesn't, as ER 2024's legend.
 */
function IstardtElement(props: ElementComponentProps): ReactElement {
  const { element } = props;
  const fill =
    (element.kind as string) === 'istardt.Effect' &&
    element.customProperties?.satisfying === 'false'
      ? NOT_SATISFYING_FILL
      : fillOf(istardt, element.kind);
  const drawn = element.display?.backgroundColor
    ? element
    : { ...element, display: { ...element.display, backgroundColor: fill } };
  return <DefaultElementComponent {...props} element={drawn} />;
}

/**
 * iStar-DT reads one actor's goals `G1`, tasks `T1` and qualities `Q1`,
 * refined by AND/OR links, and its own effects, conditions, predicates and
 * variables, which an iStar-DT model declares in its metamodel block
 * (goal-controller#119): the palette offers those, numbered so, and leaves
 * out the iStar links iStar-DT doesn't read.
 */
const istardtPalette: IstarExtension = {
  name: 'istardt-palette',
  elements: {
    'istar.Agent': { palette: false },
    'istar.Role': { palette: false },
    'istar.Resource': { palette: false },
    'istar.Goal': {
      defaultName: ({ model }) =>
        `${nextRtId(model, 'istar.Goal', istardt.elements.goal.prefix)}: Goal`,
    },
    'istar.Task': {
      defaultName: ({ model }) =>
        `${nextRtId(model, 'istar.Task', istardt.elements.task.prefix)}: Task`,
    },
    'istar.Quality': {
      defaultName: ({ model }) =>
        `${nextRtId(model, 'istar.Quality', 'Q')}: Quality`,
    },
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

/** The extension's kinds, each in its colour (IstardtElement). */
const istardtColours: IstarExtension<string, string> = {
  name: 'istardt-colours',
  elements: {
    'istardt.Effect': { component: IstardtElement },
    'istardt.Condition': { component: IstardtElement },
    'istardt.Predicate': { component: IstardtElement },
    'istardt.Variable': { component: IstardtElement },
  },
};

/** What piStar mode's palette toggle adds for a file recorded for iStar-DT. */
export const ISTARDT_PALETTE: readonly IstarExtension[] = [
  istardtPalette,
  // the canvas takes iStar's kinds' overrides; istar-ts applies these by
  // kind, to the kinds the model's metamodel block declares
  istardtColours as unknown as IstarExtension,
];

export default function IstardtDiagram() {
  return <WorkbenchCanvas extensions={ISTARDT_PALETTE} />;
}
