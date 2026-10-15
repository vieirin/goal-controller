/**
 * The workbench's one engine registry (goal-controller#124): the maps
 * `engineDialects.ts` derives from lib's engine objects are what it wrote by
 * hand before, map by map and engine by engine (the expected values below
 * are those hand-written maps, as they were).
 */
import { describe, expect, it } from 'vitest';
import {
  edge,
  edgeCheckRegistry,
  edgeEngineMapper,
  edgeOptions,
  edgeProjectResources,
  edgeV2,
  edgeV2EngineMapper,
  edgeV2Options,
  goda,
  godaCheckRegistry,
  godaEngineMapper,
  godaOptions,
  grl,
  grlAnalyses,
  grlAnalysisModel,
  grlCheckRegistry,
  grlEngineMapper,
  grlExtension,
  grlProjectResourceParsers,
  istardt,
  istardtCheckRegistry,
  istardtEngineMapper,
  istardtExtension,
  istardtOptions,
  mutrose,
  mutroseCheckRegistry,
  mutroseEngineMapper,
  mutrosePool,
  mutroseProjectResources,
  sleecEngineMapper,
  sleecOptions,
} from '@goal-controller/lib';
import {
  dialectOf,
  ENGINE_ANALYSES,
  ENGINE_CHECKS,
  ENGINE_DIALECTS,
  ENGINE_FILE_KINDS,
  ENGINE_LABEL,
  ENGINE_MAPPERS,
  ENGINE_OPTIONS,
  ENGINE_POOLS,
  ENGINE_PROJECT_RESOURCES,
  ENGINES,
  generatesFiles,
  hasOptions,
  isDialectEngine,
  notationDefinitionOf,
  outputExtensionOf,
  outputLabelOf,
  outputLanguageOf,
} from '@/lib/workbench/engineDialects';
import type { TransformEngine } from '@/lib/types';

const ALL: TransformEngine[] = [
  'edge',
  'edgev2',
  'sleec',
  'mutrose',
  'goda',
  'grl',
  'istardt',
];

/** Same keys, and each value the same object (the engines' own, not copies). */
const expectSameEntries = (
  derived: Readonly<Record<string, unknown>>,
  expected: Readonly<Record<string, unknown>>,
) => {
  expect(Object.keys(derived).sort()).toEqual(Object.keys(expected).sort());
  for (const [engine, value] of Object.entries(expected))
    expect(derived[engine], engine).toBe(value);
};

describe('the engine registry', () => {
  it('derives ENGINE_DIALECTS', () =>
    expectSameEntries(ENGINE_DIALECTS, {
      edge,
      edgev2: edgeV2,
      mutrose,
      goda,
      grl,
      istardt,
    }));

  it('derives ENGINE_CHECKS', () =>
    expectSameEntries(ENGINE_CHECKS, {
      edge: edgeCheckRegistry,
      edgev2: edgeCheckRegistry,
      mutrose: mutroseCheckRegistry,
      goda: godaCheckRegistry,
      grl: grlCheckRegistry,
      istardt: istardtCheckRegistry,
    }));

  it('derives ENGINE_PROJECT_RESOURCES (GODA and iStar-DT read nothing beside the model)', () => {
    const {
      goda: none,
      istardt: nothing,
      ...parsers
    } = ENGINE_PROJECT_RESOURCES;
    expect(none).toEqual({});
    expect(nothing).toEqual({});
    expectSameEntries(parsers, {
      edge: edgeProjectResources,
      edgev2: edgeProjectResources,
      mutrose: mutroseProjectResources,
      grl: grlProjectResourceParsers,
    });
  });

  it('derives ENGINE_POOLS', () =>
    expectSameEntries(ENGINE_POOLS, { mutrose: mutrosePool }));

  it('derives ENGINE_MAPPERS', () =>
    expectSameEntries(ENGINE_MAPPERS, {
      edge: edgeEngineMapper,
      edgev2: edgeV2EngineMapper,
      sleec: sleecEngineMapper,
      mutrose: mutroseEngineMapper,
      goda: godaEngineMapper,
      grl: grlEngineMapper,
      istardt: istardtEngineMapper,
    }));

  it('derives ENGINE_OPTIONS (MutRoSe and GRL declare none)', () => {
    const { mutrose: none, grl: nothing, ...declared } = ENGINE_OPTIONS;
    expect(none).toEqual([]);
    expect(nothing).toEqual([]);
    expectSameEntries(declared, {
      edge: edgeOptions,
      edgev2: edgeV2Options,
      sleec: sleecOptions,
      goda: godaOptions,
      istardt: istardtOptions,
    });
  });

  it('derives ENGINE_LABEL', () =>
    expect(ENGINE_LABEL).toEqual({
      edge: 'Edge',
      edgev2: 'EdgeV2',
      sleec: 'SLEEC',
      mutrose: 'MutRoSe',
      goda: 'GODA',
      grl: 'GRL',
      istardt: 'iStar-DT',
    }));

  it('derives ENGINES, in the order the UI offers them', () =>
    expect(ENGINES).toStrictEqual([
      {
        id: 'edgev2',
        label: 'EdgeV2',
        output: 'PRISM',
        extension: 'prism',
        language: 'prism',
        help: 'EDGE reference encoding, with cost and utility rewards',
      },
      {
        id: 'edge',
        label: 'Edge',
        output: 'PRISM',
        extension: 'prism',
        language: 'prism',
        help: 'Legacy Edge encoding',
      },
      {
        id: 'sleec',
        label: 'SLEEC',
        output: 'SLEEC',
        extension: 'sleec',
        language: 'text',
        help: 'SLEEC rules from the goal conditions',
      },
      {
        id: 'mutrose',
        label: 'MutRoSe',
        output: 'Runtime annotation',
        extension: 'rannot',
        language: 'rannot',
        help: "The runtime annotation MutRoSe's decomposer reads, after checking the model as it does",
      },
      {
        id: 'goda',
        label: 'GODA',
        output: 'PRISM MDP',
        extension: 'nm',
        language: 'prism',
        help: 'GODA-MDP: the PRISM MDP, its properties and its parametric reliability and cost formulas',
      },
      {
        id: 'grl',
        label: 'GRL',
        output: 'Evaluation',
        extension: 'json',
        language: 'text',
        help: "GRL (jUCMNav): evaluates the model under its strategies, jUCMNav's quantitative and qualitative propagation, the values drawn on the model",
        generates: false,
      },
      {
        id: 'istardt',
        label: 'iStar-DT',
        output: 'DT-Golog',
        extension: 'pl',
        language: 'text',
        help: "iStar-DT: the DT-Golog program (Prolog) dtx2dtg writes, for DT-Golog's solver and dtg2sim's RL environment",
      },
    ]));

  it('derives ENGINE_ANALYSES and ENGINE_FILE_KINDS', () => {
    // an analysis engine's analyses, with how it reads a model for them (#125)
    expect(Object.keys(ENGINE_ANALYSES)).toEqual(['grl']);
    expect(ENGINE_ANALYSES.grl?.analyses).toBe(grlAnalyses);
    expect(ENGINE_ANALYSES.grl?.model).toBe(grlAnalysisModel);
    expectSameEntries(ENGINE_FILE_KINDS, {
      grl: grlExtension,
      istardt: istardtExtension,
    });
  });

  it('answers the helpers as before, for every engine', () => {
    const expected = {
      edge: ['PRISM', 'prism', 'prism', true, true, edge],
      edgev2: ['PRISM', 'prism', 'prism', true, true, edgeV2],
      sleec: ['SLEEC', 'sleec', 'text', true, true, null],
      mutrose: ['Runtime annotation', 'rannot', 'rannot', true, false, mutrose],
      goda: ['PRISM MDP', 'nm', 'prism', true, true, goda],
      grl: ['Evaluation', 'json', 'text', false, false, grl],
      istardt: ['DT-Golog', 'pl', 'text', true, true, istardt],
    } as const;
    for (const engine of ALL) {
      const [output, extension, language, generates, options, dialect] =
        expected[engine];
      expect(outputLabelOf(engine), engine).toBe(output);
      expect(outputExtensionOf(engine), engine).toBe(extension);
      expect(outputLanguageOf(engine), engine).toBe(language);
      expect(generatesFiles(engine), engine).toBe(generates);
      expect(hasOptions(engine), engine).toBe(options);
      expect(dialectOf(engine), engine).toBe(dialect);
      expect(isDialectEngine(engine), engine).toBe(dialect !== null);
      expect(notationDefinitionOf(engine), engine).toBe(dialect ?? edge);
    }
  });
});
