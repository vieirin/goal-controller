/**
 * Conformity's first axis (goal-controller#171): a model's framework, and its
 * target's, against the project's, before any engine reads it; and no
 * conversion across frameworks.
 */
import { renderHook } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { withModelSettings } from '@/lib/project';
import { emptyModelText, frameworkOfModel } from '@/lib/workbench/frameworks';
import {
  EMPTY_PISTAR_MODEL,
  frameworkMismatch,
  frameworkOfMode,
  planConversion,
} from '@/lib/workbench/pistar';
import {
  projectFrameworkOf,
  useEngineConformity,
} from '@/components/workbench/engineConformity';

const EDGE = readFileSync(
  join(__dirname, '../../../../examples/edgeV2/simpleChoice.txt'),
  'utf8',
);
/** DSM3's types, without the framework recorded: the content says KAOS. */
const KAOS_CONTENT = JSON.stringify({
  actors: [],
  orphans: [{ id: 'g', text: 'Safe', type: 'kaos.Softgoal', x: 0, y: 0 }],
  dependencies: [],
  links: [],
  display: {},
  tool: 'dsm3-goals',
  metamodelVersion: '1.0',
  saveDate: '',
  diagram: { width: 800, height: 600 },
});

describe('framework conformity', () => {
  it("reads a model's framework from its content, else its record", () => {
    expect(frameworkOfModel(EDGE)).toBe('istar-2.0');
    expect(frameworkOfModel(EMPTY_PISTAR_MODEL)).toBe('istar-2.0');
    expect(frameworkOfModel(KAOS_CONTENT)).toBe('kaos');
    // DSM3's empty files share a tool: the record tells KAOS from NFR
    expect(frameworkOfModel(emptyModelText('nfr'))).toBe('nfr');
    // content wins over a record that disagrees
    expect(
      frameworkOfModel(withModelSettings(EDGE, { framework: 'nfr' })),
    ).toBe('istar-2.0');
    expect(frameworkOfModel('not json')).toBe('istar-2.0');
  });

  it('puts every mode there is today in iStar 2.0', () => {
    for (const mode of [
      'edgev2',
      'sleec',
      'grl',
      'pistarext',
      'pistar',
    ] as const)
      expect(frameworkOfMode(mode), mode).toBe('istar-2.0');
  });

  it("reports a model in another framework than the project's, and a target in another", () => {
    expect(frameworkMismatch(EDGE, 'edgev2')).toBe(null);
    expect(frameworkMismatch(EDGE, 'edgev2', 'istar-2.0')).toBe(null);
    expect(frameworkMismatch(EDGE, 'grl', 'kaos')).toBe(
      'The model is in iStar 2.0, and the project in KAOS: nothing converts a model between frameworks',
    );
    expect(frameworkMismatch(KAOS_CONTENT, 'edgev2', 'kaos')).toBe(
      'the Edge engines read iStar 2.0 models, and the project is in KAOS: nothing converts a model between frameworks',
    );
    expect(frameworkMismatch(KAOS_CONTENT, 'pistar')).toMatch(
      /^piStar reads iStar 2\.0 models, and the model is in KAOS: nothing converts/,
    );
  });

  it('refuses to plan a conversion across frameworks', () => {
    expect(() => planConversion(KAOS_CONTENT, 'edgev2')).toThrow(
      /the model is in KAOS: nothing converts a model between frameworks/,
    );
    expect(planConversion(EDGE, 'edgev2').blockers).toEqual([]);
  });

  it("reports the framework before the engine check, from the project's framework", () => {
    const { result } = renderHook(() =>
      useEngineConformity(EDGE, ['edgev2', 'pistarext'], true, 'kaos'),
    );
    for (const id of ['edgev2', 'pistarext'] as const) {
      expect(result.current.plans[id]).toEqual({
        error: expect.stringMatching(/the project in KAOS/),
      });
      expect(result.current.statusOf(id)).toBe('blocked');
    }
    const same = renderHook(() =>
      useEngineConformity(EDGE, ['pistarext'], true, 'istar-2.0'),
    );
    expect(same.result.current.statusOf('pistarext')).toBe('ready');
  });

  it("takes the project's framework from its manifest, the open model's entry first", () => {
    expect(projectFrameworkOf(null)).toBe(undefined);
    const project = (framework?: 'kaos') =>
      ({
        manifest: {
          version: 1,
          ...(framework && { framework }),
          models: [{ path: 'a.txt' }],
          projectResources: {},
          outputs: [],
        },
        models: [{ path: 'a.txt' }],
      }) as unknown as Parameters<typeof projectFrameworkOf>[0];
    expect(projectFrameworkOf(project())).toBe('istar-2.0');
    expect(projectFrameworkOf(project('kaos'))).toBe('kaos');
    // a project's models may be of several frameworks (#329): the open one's entry
    const mixed = {
      manifest: {
        version: 1,
        framework: 'nfr',
        models: [{ path: 'a.txt' }, { path: 'b.txt', framework: 'kaos' }],
        projectResources: {},
        outputs: [],
      },
      models: [{ path: 'a.txt' }, { path: 'b.txt' }],
    } as unknown as Parameters<typeof projectFrameworkOf>[0];
    expect(projectFrameworkOf(mixed)).toBe('nfr');
    expect(projectFrameworkOf(mixed, 'b.txt')).toBe('kaos');
  });
});
