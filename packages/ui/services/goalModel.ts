import { GoalTree, Model } from '@goal-controller/goal-tree';
import { parsePistar } from '@istar-ts/core';
import {
  edgeEngineMapper,
  edgeV2EngineMapper,
  godaEngineMapper,
  mutroseEngineMapper,
  sleecEngineMapper,
  type EngineMapper,
  type GoalTreeType,
  type IStarModel,
} from '@goal-controller/lib';

export interface ParseError {
  success: false;
  error: string;
  stage: 'parse' | 'validate' | 'tree';
}

export interface ParseOptions {
  /** remove the single-child goals before validating (see goal-tree's `Model.reduce`) */
  reduce?: boolean;
}

/** A model parsed, validated and read by an engine's mapper into its tree. */
export type ParseModelResult<TTree> =
  | { success: true; model: IStarModel; tree: TTree }
  | ParseError;

/**
 * Goal model - handles parsing, validation, and tree conversion operations
 */
export const GoalModel = {
  /**
   * Parse and validate model, returning the raw model (no tree)
   */
  parseModel(
    modelJson: string,
    options: ParseOptions = {},
  ): { success: true; model: IStarModel } | ParseError {
    // Parse the piStar file
    let model: IStarModel;
    try {
      model = parsePistar(modelJson);
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
      model = Model.validate(model);
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
  parseWith<
    TGoal,
    TTask,
    TResource,
    TGoalKeys extends string,
    TTaskKeys extends string,
    TResourceKeys extends string,
    TQualityKeys extends string,
  >(
    modelJson: string,
    mapper: EngineMapper<
      TGoal,
      TTask,
      TResource,
      TGoalKeys,
      TTaskKeys,
      TResourceKeys,
      TQualityKeys
    >,
    options: ParseOptions = {},
  ): ParseModelResult<GoalTreeType<TGoal, TTask, TResource>> {
    const parseResult = this.parseModel(modelJson, options);
    if (!parseResult.success) return parseResult;
    try {
      const tree = GoalTree.fromModel(parseResult.model, mapper).nodes;
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

  parseForGoda(modelJson: string, options: ParseOptions = {}) {
    return this.parseWith(modelJson, godaEngineMapper, options);
  },
};
