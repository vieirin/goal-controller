/**
 * The workbench's one engine registry (goal-controller#124): the maps
 * `engineDialects.ts` derives from lib's engine objects are what it wrote by
 * hand before, map by map and engine by engine (the expected values below
 * are those hand-written maps, as they were).
 */
import { describe, expect, it } from 'vitest';
import {
  cgm,
  cgmAnalyses,
  cgmAnalysisModel,
  cgmCheckRegistry,
  cgmEngineMapper,
  cgmExtension,
  cgmProjectResourceParsers,
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
  kaos,
  kaosdocEngineMapper,
  kaosltsEngineMapper,
  kaosexpert,
  kaosexpertAnalyses,
  kaosexpertAnalysisModel,
  kaosexpertOptions,
  kaosprop,
  kaosres,
  kaosresAnalyses,
  kaosresAnalysisModel,
  kaosresOptions,
  kaossim,
  kaossimAnalyses,
  kaossimAnalysisModel,
  kaossimOptions,
  kaospropAnalyses,
  kaospropAnalysisModel,
  kaospropEngineMapper,
  mutrose,
  mutroseCheckRegistry,
  mutroseEngineMapper,
  mutrosePool,
  mutroseProjectResources,
  nfrprop,
  nfrpropAnalyses,
  nfrpropProjectResourceParsers,
  nfrpropAnalysisModel,
  nfrpropEngineMapper,
  sleecEngineMapper,
  sleecOptions,
  tropos4as,
  tropos4asAnalyses,
  tropos4asAnalysisModel,
  tropos4asCheckRegistry,
  tropos4asEngineMapper,
  tropos4asExtension,
  tropos4asProjectResourceParsers,
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
  FRAMEWORK_ENGINE_DIALECTS,
  FRAMEWORK_ENGINE_PROJECT_RESOURCES,
  generatesFiles,
  hasOptions,
  isDialectEngine,
  isFrameworkEngine,
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
  'tropos4as',
  'cgm',
  'kaosdoc',
  'kaoslts',
  'kaosprop',
  'kaosexpert',
  'kaosres',
  'kaossim',
  'nfrprop',
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
      tropos4as,
      cgm,
    }));

  it("keeps the other frameworks' engines apart, their dialects their frameworks' (#171)", () => {
    expectSameEntries(FRAMEWORK_ENGINE_DIALECTS, {
      kaosdoc: kaos,
      kaoslts: kaos,
      kaosprop,
      kaosexpert,
      kaosres,
      kaossim,
      nfrprop,
    });
    expect(ALL.filter(isFrameworkEngine)).toEqual([
      'kaosdoc',
      'kaoslts',
      'kaosprop',
      'kaosexpert',
      'kaosres',
      'kaossim',
      'nfrprop',
    ]);
  });

  it('derives ENGINE_CHECKS', () =>
    expectSameEntries(ENGINE_CHECKS, {
      edge: edgeCheckRegistry,
      edgev2: edgeCheckRegistry,
      mutrose: mutroseCheckRegistry,
      goda: godaCheckRegistry,
      grl: grlCheckRegistry,
      istardt: istardtCheckRegistry,
      tropos4as: tropos4asCheckRegistry,
      cgm: cgmCheckRegistry,
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
      tropos4as: tropos4asProjectResourceParsers,
      cgm: cgmProjectResourceParsers,
    });
  });

  it('derives FRAMEWORK_ENGINE_PROJECT_RESOURCES, ENGINE_PROJECT_RESOURCES’s counterpart (kaosdoc and kaosprop read nothing beside the model, goal-controller#334)', () => {
    const {
      kaosdoc: none,
      kaoslts: noLts,
      kaosprop: nothing,
      kaosres: neither,
      ...parsers
    } = FRAMEWORK_ENGINE_PROJECT_RESOURCES;
    expect(none).toEqual({});
    expect(noLts).toEqual({});
    expect(nothing).toEqual({});
    expect(neither).toEqual({});
    expectSameEntries(parsers, {
      kaosexpert: FRAMEWORK_ENGINE_PROJECT_RESOURCES.kaosexpert,
      kaossim: FRAMEWORK_ENGINE_PROJECT_RESOURCES.kaossim,
      nfrprop: nfrpropProjectResourceParsers,
    });
    // kaossim's designs (#193 D2)
    expect(Object.keys(FRAMEWORK_ENGINE_PROJECT_RESOURCES.kaossim)).toEqual([
      'design',
    ]);
    // kaosexpert's experts, calibration variables and evidence items (#190, #199)
    expect(Object.keys(FRAMEWORK_ENGINE_PROJECT_RESOURCES.kaosexpert)).toEqual([
      'expert',
      'calibration',
      'evidence',
    ]);
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
      tropos4as: tropos4asEngineMapper,
      cgm: cgmEngineMapper,
      kaosdoc: kaosdocEngineMapper,
      kaoslts: kaosltsEngineMapper,
      kaosprop: kaospropEngineMapper,
      // kaosprop's: its entries and link keys (#190)
      kaosexpert: kaospropEngineMapper,
      kaosres: kaospropEngineMapper,
      kaossim: kaospropEngineMapper,
      nfrprop: nfrpropEngineMapper,
    }));

  it('derives ENGINE_OPTIONS (MutRoSe, GRL, Tropos4AS and contextual goal models declare none)', () => {
    const {
      mutrose: none,
      grl: nothing,
      tropos4as: neither,
      cgm: nor,
      kaosdoc: noKaos,
      kaoslts: noLts,
      kaosprop: noKaosprop,
      nfrprop: noNfr,
      ...declared
    } = ENGINE_OPTIONS;
    expect(noKaos).toEqual([]);
    expect(noLts).toEqual([]);
    expect(noKaosprop).toEqual([]);
    expect(noNfr).toEqual([]);
    expect(none).toEqual([]);
    expect(nothing).toEqual([]);
    expect(neither).toEqual([]);
    expect(nor).toEqual([]);
    expectSameEntries(declared, {
      edge: edgeOptions,
      edgev2: edgeV2Options,
      sleec: sleecOptions,
      goda: godaOptions,
      istardt: istardtOptions,
      kaosexpert: kaosexpertOptions,
      kaosres: kaosresOptions,
      kaossim: kaossimOptions,
    });
  });

  it('offers the EvoChecker evolvable parameters switch for edgeV2 (#442), off by default', () => {
    const evolvable = edgeV2Options.find(
      (option) => option.key === 'evolvableDecisionVars',
    );
    expect(evolvable).toBeDefined();
    expect(evolvable?.value).toEqual({ type: 'bool' });
    expect(evolvable?.default).toBe(false);
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
      tropos4as: 'Tropos4AS',
      cgm: 'Contextual goal model',
      kaosdoc: 'KAOS document',
      kaoslts: 'KAOS LTS (FSP)',
      kaosprop: 'KAOS obstacle probabilities',
      kaosexpert: 'KAOS expert estimates and uncertainty',
      kaosres: 'KAOS countermeasure selection',
      kaossim: 'KAOS quantitative goals',
      nfrprop: 'NFR propagation',
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
      {
        id: 'tropos4as',
        label: 'Tropos4AS',
        output: 'Lifecycle',
        extension: 'txt',
        language: 'text',
        help: 'Tropos4AS: runs the goal lifecycle of AAMAS 2009 over a scenario, each goal’s state per step drawn on the model',
        generates: false,
      },
      {
        id: 'cgm',
        label: 'Contextual goal model',
        output: 'Variants',
        extension: 'txt',
        language: 'text',
        help: 'Contextual goal models (REJ 2010, IST 2013): contexts at the variation points of a Tropos model, with context analysis',
        generates: false,
      },
      {
        id: 'kaosdoc',
        label: 'KAOS document',
        output: 'Requirements document',
        extension: 'md',
        language: 'text',
        help: 'A requirements document from the KAOS model: goals with their fit criteria, refinements, requirements and expectations, agents, conflicts',
      },
      {
        id: 'kaoslts',
        label: 'KAOS LTS (FSP)',
        output: 'FSP for LTSA',
        extension: 'lts',
        language: 'text',
        help: "The operation model as FSP for LTSA, KAOS2LTSA's derivation: fluents, domain and required conditions as constraints, one composition per agent and the system; and each requirement's operationalisation checked for completeness",
      },
      {
        id: 'kaosprop',
        label: 'KAOS obstacle probabilities',
        output: 'Probabilities',
        extension: 'json',
        language: 'text',
        help: "Cailliau and van Lamsweerde's probabilistic obstacle analysis (RE'12): each obstacle's probability and each goal's estimated probability of satisfaction against its required rate, step by step, and the critical obstacle combinations",
        generates: false,
      },
      {
        id: 'kaosexpert',
        label: 'KAOS expert estimates and uncertainty',
        output: 'Uncertainty',
        extension: 'json',
        language: 'text',
        help: "Cailliau and van Lamsweerde's handling of knowledge uncertainty (RE'15): the experts' estimates combined by Cooke's model, each goal's probability of satisfaction sampled by Monte Carlo over its obstacles' BDD, with its violation uncertainty and uncertainty spread against its required rate, and the critical obstacles",
        generates: false,
      },
      {
        id: 'kaosres',
        label: 'KAOS countermeasure selection',
        output: 'Selections',
        extension: 'json',
        language: 'text',
        help: "Cailliau and van Lamsweerde's selection of countermeasures to obstacles (SEAMS'17): each selection of resolutions integrated into the model and propagated, the safe, consistent and cost-optimal ones, and the one of lowest cost that maximises the high-level goals' satisfaction",
        generates: false,
      },
      {
        id: 'kaossim',
        label: 'KAOS quantitative goals',
        output: 'Designs',
        extension: 'json',
        language: 'text',
        help: "Letier and van Lamsweerde's partial goal satisfaction (FSE'04), simulated as Heaven and Letier do (RE'11): quality variables, refinement equations and leaf estimates, each design's objective functions by Monte Carlo, and the Pareto-optimal designs, by every design or by NSGA-II",
        generates: false,
      },
      {
        id: 'nfrprop',
        label: 'NFR propagation',
        output: 'Labels',
        extension: 'json',
        language: 'text',
        help: "The NFR Framework's label propagation (Chung et al.): each softgoal satisficed, denied, in conflict or undecided, step by step, drawn on the model",
        generates: false,
      },
    ]));

  it('derives ENGINE_ANALYSES and ENGINE_FILE_KINDS', () => {
    // an analysis engine's analyses, with how it reads a model for them (#125)
    expect(Object.keys(ENGINE_ANALYSES)).toEqual([
      'grl',
      'tropos4as',
      'cgm',
      'kaosprop',
      'kaosexpert',
      'kaosres',
      'kaossim',
      'nfrprop',
    ]);
    expect(ENGINE_ANALYSES.kaossim?.analyses).toBe(kaossimAnalyses);
    expect(ENGINE_ANALYSES.kaossim?.model).toBe(kaossimAnalysisModel);
    expect(ENGINE_ANALYSES.kaosexpert?.analyses).toBe(kaosexpertAnalyses);
    expect(ENGINE_ANALYSES.kaosres?.analyses).toBe(kaosresAnalyses);
    expect(ENGINE_ANALYSES.kaosres?.model).toBe(kaosresAnalysisModel);
    expect(ENGINE_ANALYSES.kaosexpert?.model).toBe(kaosexpertAnalysisModel);
    expect(ENGINE_ANALYSES.kaosprop?.analyses).toBe(kaospropAnalyses);
    expect(ENGINE_ANALYSES.kaosprop?.model).toBe(kaospropAnalysisModel);
    expect(ENGINE_ANALYSES.nfrprop?.analyses).toBe(nfrpropAnalyses);
    expect(ENGINE_ANALYSES.nfrprop?.model).toBe(nfrpropAnalysisModel);
    expect(ENGINE_ANALYSES.grl?.analyses).toBe(grlAnalyses);
    expect(ENGINE_ANALYSES.grl?.model).toBe(grlAnalysisModel);
    expect(ENGINE_ANALYSES.tropos4as?.analyses).toBe(tropos4asAnalyses);
    expect(ENGINE_ANALYSES.tropos4as?.model).toBe(tropos4asAnalysisModel);
    expect(ENGINE_ANALYSES.cgm?.analyses).toBe(cgmAnalyses);
    expect(ENGINE_ANALYSES.cgm?.model).toBe(cgmAnalysisModel);
    expectSameEntries(ENGINE_FILE_KINDS, {
      grl: grlExtension,
      istardt: istardtExtension,
      tropos4as: tropos4asExtension,
      cgm: cgmExtension,
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
      tropos4as: ['Lifecycle', 'txt', 'text', false, false, tropos4as],
      cgm: ['Variants', 'txt', 'text', false, false, cgm],
      kaosdoc: ['Requirements document', 'md', 'text', true, false, kaos],
      kaoslts: ['FSP for LTSA', 'lts', 'text', true, false, kaos],
      kaosprop: ['Probabilities', 'json', 'text', false, false, kaosprop],
      kaosexpert: ['Uncertainty', 'json', 'text', false, true, kaosexpert],
      kaosres: ['Selections', 'json', 'text', false, true, kaosres],
      kaossim: ['Designs', 'json', 'text', false, true, kaossim],
      nfrprop: ['Labels', 'json', 'text', false, false, nfrprop],
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
      // a framework's engine has no iStar notation: the editors' default
      const istar = dialect !== null && !isFrameworkEngine(engine);
      expect(isDialectEngine(engine), engine).toBe(istar);
      expect(notationDefinitionOf(engine), engine).toBe(istar ? dialect : edge);
    }
  });
});
