import {
  GoalTree,
  Model,
  type KindEngineMapper,
  type NodeOf,
  type RootReading,
} from '@goal-controller/goal-tree';
import { parsePistar, type IstarModel } from '@istar-ts/core';
import type { Framework } from '@goal-controller/dialect';
import { recordedMode } from '../lib/project';
import { declaresKinds } from '../lib/workbench/dialects';
import { FRAMEWORK_ROOTS, frameworkOfModel } from '../lib/workbench/frameworks';
import {
  edgeEngineMapper,
  edgeV2EngineMapper,
  godaEngineMapper,
  kaosdocEngineMapper,
  kaosdocGoalModel,
  kaosltsEngineMapper,
  kaosltsGoalModel,
  mutroseEngineMapper,
  sleecEngineMapper,
  type KaosdocGoalModel,
  type KaosltsGoalModel,
  type AnyModel,
} from '@goal-controller/lib';

export interface ParseError {
  success: false;
  error: string;
  stage: 'parse' | 'validate' | 'tree';
}

export interface ParseOptions {
  /** remove the single-child goals before validating (see goal-tree's `Model.reduce`) */
  reduce?: boolean;
  /** the framework it is read in (goal-controller#171); by default, the model's (frameworkOfModel) */
  framework?: Framework;
}

/** The tree an engine's mapper reads a model into, its nodes typed by kind (goal-controller#215). */
type TreeOf<M> =
  M extends KindEngineMapper<any, any, any, any, any, any>
    ? NodeOf<M>[]
    : never;

/** A model parsed, validated and read by an engine's mapper into its tree. */
export type ParseModelResult<TTree> =
  | { success: true; model: AnyModel; tree: TTree }
  | ParseError;

/**
 * Goal model - handles parsing, validation, and tree conversion operations
 */
export const GoalModel = {
  /**
   * Parse and validate model, returning the raw model (no tree); its roots
   * are read as `dialect` reads them (GODA leaves unlinked Resources out)
   */
  parseModel(
    modelJson: string,
    options: ParseOptions = {},
    dialect?: RootReading,
  ): { success: true; model: AnyModel } | ParseError {
    // Parse the piStar file
    let model: AnyModel;
    try {
      // an engine whose models declare kinds of their own reads its block,
      // as does any model of another framework (goal-controller#194)
      const mode = recordedMode(modelJson);
      const framework = options.framework ?? frameworkOfModel(modelJson);
      // another framework's kinds are the IR's to read (#171, PR D)
      model = parsePistar(modelJson, {
        metamodel: FRAMEWORK_ROOTS[framework],
        fileMetamodel: declaresKinds(mode, framework),
      });
    } catch (error) {
      return {
        success: false,
        error: `Invalid model: ${error instanceof Error ? error.message : 'Unknown parse error'}`,
        stage: 'parse',
      };
    }

    if (options.reduce) model = Model.reduce(model).model;

    // Validate model (marks the root of each actor)
    try {
      model = Model.validate(model, dialect);
    } catch (error) {
      return {
        success: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown validation error'}`,
        stage: 'validate',
      };
    }

    return { success: true, model };
  },

  /** Parse model JSON, validate it, and read it into an engine's tree. */
  parseWith<M extends { dialect?: RootReading }>(
    modelJson: string,
    mapper: M,
    options: ParseOptions = {},
  ): ParseModelResult<TreeOf<M>> {
    const parseResult = this.parseModel(modelJson, options, mapper.dialect);
    if (!parseResult.success) return parseResult;
    try {
      const tree = GoalTree.fromModel(parseResult.model, mapper as never)
        .nodes as TreeOf<M>;
      return { success: true, model: parseResult.model, tree };
    } catch (error) {
      return {
        success: false,
        error: `Tree conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'tree',
      };
    }
  },

  parseForEdge(modelJson: string, options: ParseOptions = {}) {
    return this.parseWith(modelJson, edgeEngineMapper, options);
  },

  parseForEdgeV2(modelJson: string, options: ParseOptions = {}) {
    return this.parseWith(modelJson, edgeV2EngineMapper, options);
  },

  parseForSleec(modelJson: string, options: ParseOptions = {}) {
    return this.parseWith(modelJson, sleecEngineMapper, options);
  },

  parseForMutrose(modelJson: string, options: ParseOptions = {}) {
    return this.parseWith(modelJson, mutroseEngineMapper, options);
  },

  /**
   * A KAOS model as kaoslts reads it (goal-controller#209): parsed in its
   * framework, its IR (goals, agents, operations, objects, links) built.
   */
  parseForKaoslts(modelJson: string):
    | {
        success: true;
        model: AnyModel;
        tree: null;
        goalModel: KaosltsGoalModel;
      }
    | ParseError {
    const parseResult = this.parseModel(
      modelJson,
      {},
      kaosltsEngineMapper.dialect,
    );
    if (!parseResult.success) return parseResult;
    try {
      const goalModel = kaosltsGoalModel(parseResult.model);
      return { ...parseResult, tree: null, goalModel };
    } catch (error) {
      return {
        success: false,
        error: `Tree conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'tree',
      };
    }
  },

  /**
   * A KAOS model as kaosdoc reads it (goal-controller#171): parsed in its
   * framework, its IR (trees on the paper, links, elements) built.
   */
  parseForKaosdoc(modelJson: string):
    | {
        success: true;
        model: AnyModel;
        tree: null;
        goalModel: KaosdocGoalModel;
      }
    | ParseError {
    const parseResult = this.parseModel(
      modelJson,
      {},
      kaosdocEngineMapper.dialect,
    );
    if (!parseResult.success) return parseResult;
    try {
      const goalModel = kaosdocGoalModel(parseResult.model);
      return { ...parseResult, tree: null, goalModel };
    } catch (error) {
      return {
        success: false,
        error: `Tree conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'tree',
      };
    }
  },

  /**
   * A model read as a graph (an analysis engine's, GRL's; iStar-DT's writer):
   * parsed in its framework (goal-controller#171) with the kinds its block
   * declares, without a root or a tree.
   */
  parseAsGraph(
    modelJson: string,
  ):
    | { success: true; tree: null; model: IstarModel<string, string> }
    | ParseError {
    try {
      const model = parsePistar(modelJson, {
        metamodel: FRAMEWORK_ROOTS[frameworkOfModel(modelJson)],
        fileMetamodel: true,
      });
      return { success: true, tree: null, model };
    } catch (error) {
      return {
        success: false,
        error: `Invalid model: ${error instanceof Error ? error.message : 'Unknown parse error'}`,
        stage: 'parse',
      };
    }
  },

  parseForGoda(modelJson: string, options: ParseOptions = {}) {
    return this.parseWith(modelJson, godaEngineMapper, options);
  },
};
