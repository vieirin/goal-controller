import { GoalModel as Parsing } from '../../services/goalModel';
import type { ParseError } from '../../services/goalModel';

export type {
  EdgeParseResult,
  SleecParseResult,
  EdgeV2ParseResult,
  ParseError,
  EdgeParseModelResult,
  SleecParseModelResult,
  EdgeV2ParseModelResult,
} from '../../services/goalModel';

/** Adds the HTTP status code lookup the routes need to services/goalModel's parsing. */
export const GoalModel = {
  ...Parsing,
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
