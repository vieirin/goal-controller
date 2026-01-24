import {
  convertToTree,
  validateModel,
  type GoalTree,
  type Model,
} from '@goal-controller/lib';

export interface ParseResult {
  success: true;
  model: Model;
  tree: GoalTree;
}

export interface ParseError {
  success: false;
  error: string;
  stage: 'parse' | 'validate' | 'tree';
}

export type ParseModelResult = ParseResult | ParseError;

/**
 * Goal model - handles parsing, validation, and tree conversion operations
 */
export const GoalModel = {
  /**
   * Parse model JSON, validate it, and convert to tree in one operation
   */
  parse(modelJson: string): ParseModelResult {
    // Parse JSON
    let model: Model;
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
      validateModel({ model });
    } catch (error) {
      return {
        success: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown validation error'}`,
        stage: 'validate',
      };
    }

    // Convert to tree
    let tree: GoalTree;
    try {
      tree = convertToTree({ model });
    } catch (error) {
      return {
        success: false,
        error: `Tree conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stage: 'tree',
      };
    }

    return {
      success: true,
      model,
      tree,
    };
  },

  /**
   * Check if a parse result is successful
   */
  isSuccess(result: ParseModelResult): result is ParseResult {
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
