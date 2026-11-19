'use client';

import { ENGINE_DIALECTS } from '@/lib/workbench/engineDialects';
import { nextRtId } from '@/lib/workbench/pistar';
import type { IstarExtension } from '@istar-ts/react';

const { goda } = ENGINE_DIALECTS;

/**
 * GODA reads goals `G1` and tasks `T1.1` refined by AND/OR links (its
 * resources are read and left out): the palette offers those, and new ones
 * are numbered so.
 */
const godaPalette: IstarExtension = {
  name: 'goda-palette',
  elements: {
    'istar.Agent': { palette: false },
    'istar.Role': { palette: false },
    'istar.Quality': { palette: false },
    'istar.Goal': {
      defaultName: ({ model }) =>
        `${nextRtId(model, 'istar.Goal', goda.elements.goal.prefix)}: Goal`,
    },
    'istar.Task': {
      defaultName: ({ model }) =>
        `${nextRtId(model, 'istar.Task', goda.elements.task.prefix)}: Task`,
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

/**
 * GODA's canvas extensions (the registry's `palette`): its diagram's, and
 * what piStar mode's palette toggle adds for a file recorded for it.
 */
const GODA_PALETTE: readonly IstarExtension[] = [godaPalette];

export default GODA_PALETTE;
