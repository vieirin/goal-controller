'use client';

import { nextRtId } from '@/lib/workbench/pistar';
import type { IstarExtension } from '@istar-ts/react';

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
