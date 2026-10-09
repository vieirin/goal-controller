/**
 * How the Edge engines read goal texts and assertions: with the goal
 * language (@goal-controller/goal-language), and what their definitions say
 * its operators are (./goalDetail, ./assertionVariables).
 */
import type { WithNotation } from '@goal-controller/dialect';
import type { GoalNameParser } from '@goal-controller/goal-tree';
import {
  errorText,
  parseElementLine,
  parseValue,
  readNotation,
} from '@goal-controller/goal-language';
import { edge } from '../edge/definition';
import { edgeV2 } from '../edgeV2/definition';
import {
  assertionVariables,
  type AssertionVariable,
} from './assertionVariables';
import { EDGE_CASCADE, EDGE_V2_CASCADE, edgeGoalDetail } from './goalDetail';

/** As ANTLR's default listener did: reported, and the text read as far as it goes. */
const report = (
  message: string,
  onSyntaxError: ((message: string) => void) | undefined,
) =>
  onSyntaxError ? onSyntaxError(message) : console.error(`line ${message}`);

const goalNames =
  (
    definition: WithNotation & { name: string },
    cascade: readonly string[],
  ): GoalNameParser =>
  ({ goalText, onSyntaxError }) => {
    const read = parseElementLine(goalText);
    for (const error of read.errors) report(errorText(error), onSyntaxError);
    const notation = read.value?.notation ?? null;
    // what the language reads but this engine does not
    for (const symbol of readNotation(definition, notation).disabled)
      report(
        `1:${Math.max(goalText.indexOf(symbol), 0)} \`${symbol}\` is not an operator of ${definition.name}`,
        onSyntaxError,
      );
    return edgeGoalDetail(definition, cascade, read.value);
  };

/** Edge's goal texts (`G1: Name [G2;G3]`, a choice is `[+]`). */
export const edgeGoalNames = goalNames(edge, EDGE_CASCADE);

/** EdgeV2's goal texts (`G1: Name [G2?G3]`). */
export const edgeV2GoalNames = goalNames(edgeV2, EDGE_V2_CASCADE);

/** The variables an assertion names (`battery > 20 & !charging`). */
export const getAssertionVariables = ({
  assertionSentence,
}: {
  assertionSentence: string;
}): AssertionVariable[] => {
  if (!assertionSentence) return [];
  const read = parseValue('assertion', assertionSentence);
  for (const error of read.errors) report(errorText(error), undefined);
  return assertionVariables(read.value);
};
