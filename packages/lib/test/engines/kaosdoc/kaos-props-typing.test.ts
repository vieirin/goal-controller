/**
 * kaos dialect property keys stay literal after schemaProperties
 * (goal-controller#229): a goal's props.Type is its vocabulary's union.
 */
import { describe, it } from 'mocha';
import type { ElementInput } from '@goal-controller/goal-tree';
import { kaos } from '../../../src/dialects/kaos';

type GoalInput = ElementInput<typeof kaos, 'kaos.BehavioralGoal'>;

describe('kaos schemaProperties typing (#229)', () => {
  it('a goal’s props.Type is its vocabulary’s union', () => {
    const check = (_props: GoalInput['props']): void => undefined;
    check({
      Type: 'Achieve',
      Category: 'Safety',
      Priority: 'high',
    });
    // @ts-expect-error a misspelt key is not a goal property
    check({ Tpye: 'Achieve' });
    // @ts-expect-error Type is the vocabulary, not any string
    check({ Type: 'Bogus' });
  });
});
