import { GoalTree, Model } from '@goal-controller/goal-tree';
import { parsePistar } from '@istar-ts/core';
import {
  edgeEngineMapper,
  edgeLangiumEngineMapper,
  edgeV2EngineMapper,
  sleecEngineMapper,
  type EdgeGoalTree,
  type EdgeV2GoalTree,
  type SleecGoalTree,
  type IStarModel,
} from '@goal-controller/lib';

export interface EdgeParseResult {
  success: true;
  model: IStarModel;
  tree: EdgeGoalTree;
}

export interface SleecParseResult {
  success: true;
  model: IStarModel;
  tree: SleecGoalTree;
}

export interface EdgeV2ParseResult {
  success: true;
  model: IStarModel;
  tree: EdgeV2GoalTree;
}

export interface ParseError {
  success: false;
  error: string;
  stage: 'parse' | 'validate' | 'tree';
}

export interface ParseOptions {
  /** remove the single-child goals before validating (see goal-tree's `Model.reduce`) */
  reduce?: boolean;
}

export type EdgeParseModelResult = EdgeParseResult | ParseError;
export type SleecParseModelResult = SleecParseResult | ParseError;
export type EdgeV2ParseModelResult = EdgeV2ParseResult | ParseError;

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

  /**
   * Parse model JSON, validate it, and convert to Edge tree
   */
  parseForEdge(
    modelJson: string,
    options: ParseOptions = {},
  ): EdgeParseModelResult {
    const parseResult = this.parseModel(modelJson, options);
    if (!parseResult.success) {
      return parseResult;
    }

    // Convert to Edge tree
    let tree: EdgeGoalTree;
    try {
      tree = GoalTree.fromModel(parseResult.model, edgeEngineMapper).nodes;
    } catch (error) {
      return {
        success: false,
        error: `Tree conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'tree',
      };
    }

    return {
      success: true,
      model: parseResult.model,
      tree,
    };
  },

  /**
   * Parse model JSON, validate it, and convert to SLEEC tree
   */
  parseForSleec(
    modelJson: string,
    options: ParseOptions = {},
  ): SleecParseModelResult {
    const parseResult = this.parseModel(modelJson, options);
    if (!parseResult.success) {
      return parseResult;
    }

    // Convert to SLEEC tree
    let tree: SleecGoalTree;
    try {
      tree = GoalTree.fromModel(parseResult.model, sleecEngineMapper).nodes;
    } catch (error) {
      return {
        success: false,
        error: `Tree conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'tree',
      };
    }

    return {
      success: true,
      model: parseResult.model,
      tree,
    };
  },

  /**
   * Parse model JSON, validate it, and convert to Edge V2 tree
   */
  parseForEdgeV2(
    modelJson: string,
    options: ParseOptions = {},
  ): EdgeV2ParseModelResult {
    return this.parseWithEdgeV2Mapper(modelJson, options, edgeV2EngineMapper);
  },

  /**
   * Parse model JSON, validate it, and convert to an Edge V2 tree, reading the
   * RT notation with the Langium grammar (edgeLangium)
   */
  parseForEdgeLangium(
    modelJson: string,
    options: ParseOptions = {},
  ): EdgeV2ParseModelResult {
    return this.parseWithEdgeV2Mapper(
      modelJson,
      options,
      edgeLangiumEngineMapper,
    );
  },

  parseWithEdgeV2Mapper(
    modelJson: string,
    options: ParseOptions,
    mapper: typeof edgeV2EngineMapper,
  ): EdgeV2ParseModelResult {
    const parseResult = this.parseModel(modelJson, options);
    if (!parseResult.success) {
      return parseResult;
    }

    let tree: EdgeV2GoalTree;
    try {
      tree = GoalTree.fromModel(parseResult.model, mapper).nodes;
    } catch (error) {
      return {
        success: false,
        error: `Tree conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'tree',
      };
    }

    return {
      success: true,
      model: parseResult.model,
      tree,
    };
  },

  /**
   * Legacy parse method - uses Edge tree (deprecated, use parseForEdge)
   * @deprecated Use parseForEdge or parseForSleec instead
   */
  parse(modelJson: string): EdgeParseModelResult {
    return this.parseForEdge(modelJson);
  },

  /**
   * Check if a parse result is successful
   */
  isSuccess(
    result:
      | EdgeParseModelResult
      | SleecParseModelResult
      | EdgeV2ParseModelResult,
  ): result is EdgeParseResult | SleecParseResult | EdgeV2ParseResult {
    return result.success;
  },
};
