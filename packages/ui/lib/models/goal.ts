import { GoalTree, Model } from '@goal-controller/goal-tree';
import {
  edgeEngineMapper,
  sleecEngineMapper,
  type EdgeGoalTree,
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

export interface ParseError {
  success: false;
  error: string;
  stage: 'parse' | 'validate' | 'tree';
}

export type EdgeParseModelResult = EdgeParseResult | ParseError;
export type SleecParseModelResult = SleecParseResult | ParseError;

/**
 * Goal model - handles parsing, validation, and tree conversion operations
 */
export const GoalModel = {
  /**
   * Parse and validate model, returning the raw model (no tree)
   */
  parseModel(
    modelJson: string,
  ): { success: true; model: IStarModel } | ParseError {
    // Parse JSON
    let model: IStarModel;
    try {
      model = JSON.parse(modelJson);
    } catch (error) {
      return {
        success: false,
        error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown parse error'}`,
        stage: 'parse',
      };
    }

    // Validate model
    try {
      Model.validate(model);
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
  parseForEdge(modelJson: string): EdgeParseModelResult {
    const parseResult = this.parseModel(modelJson);
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
  parseForSleec(modelJson: string): SleecParseModelResult {
    const parseResult = this.parseModel(modelJson);
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
    result: EdgeParseModelResult | SleecParseModelResult,
  ): result is EdgeParseResult | SleecParseResult {
    return result.success;
  },

  /**
   * Get HTTP status code for a parse error stage
   */
  getErrorStatus(stage: ParseError['stage']): number {
    switch (stage) {
      case 'parse':
      case 'validate':
        return 400; // Bad request - client error
      case 'tree':
        return 500; // Internal error - server/processing error
      default:
        return 500;
    }
  },
};
