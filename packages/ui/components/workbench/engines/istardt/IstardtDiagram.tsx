'use client';

import { ENGINE_DIALECTS } from '@/lib/workbench/engineDialects';
import { nextRtId } from '@/lib/workbench/pistar';
import type { IstarExtension } from '@istar-ts/react';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

const { istardt } = ENGINE_DIALECTS;

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

/** What piStar mode's palette toggle adds for a file recorded for iStar-DT. */
export const ISTARDT_PALETTE: readonly IstarExtension[] = [istardtPalette];

export default function IstardtDiagram() {
  return <WorkbenchCanvas extensions={ISTARDT_PALETTE} />;
}
