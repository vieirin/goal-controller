import type { Dictionary } from 'lodash';
import type { GoalExecutionDetail } from '../../types/';

/** The goal ids each operator of a notation collected, as the edgeV2 walker leaves them. */
export type NotationLists = {
  alternative: string[];
  degradationList: string[];
  interleaved: string[];
  sequence: string[];
  anyOrder: string[];
  retry: Dictionary<number>;
  choice: string[];
};

export const emptyNotationLists = (): NotationLists => ({
  alternative: [],
  degradationList: [],
  interleaved: [],
  sequence: [],
  anyOrder: [],
  retry: {},
  choice: [],
});

/**
 * The construct a notation expresses: when several operators appear, the first
 * of degradation, sequence, any order, alternative, interleaved, choice wins.
 */
export const toExecutionDetail = ({
  alternative,
  degradationList,
  interleaved,
  sequence,
  anyOrder,
  retry,
  choice,
}: NotationLists): GoalExecutionDetail | null => {
  if (degradationList.length > 0) {
    const executionDetail: any = {
      type: 'degradation',
      degradationList,
    };

    // Only include retryMap if it's not empty
    if (Object.keys(retry).length > 0) {
      executionDetail.retryMap = retry;
    }

    return executionDetail;
  }

  if (sequence.length > 0) {
    return { type: 'sequence', sequence };
  }

  if (anyOrder.length > 0) {
    return { type: 'anyOrder', anyOrder };
  }

  if (alternative.length > 0) {
    return { type: 'alternative', alternative };
  }
  if (interleaved.length > 0) {
    return { type: 'interleaved', interleaved };
  }

  if (choice.length > 0) {
    return { type: 'choice', choice };
  }

  return null;
};
