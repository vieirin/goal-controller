import * as assert from 'assert';
import { describe, it } from 'mocha';
import type { CheckNameOf, ConstructOf } from '@goal-controller/dialect';
import { goalNameParserFor } from '@goal-controller/goal-language';
import type { GoalExecutionDetail as EdgeDetail } from '../../src/engines/edge/types';
import type { GoalExecutionDetail as EdgeV2Detail } from '../../src/engines/edgeV2/types';
import type { Construct } from '../../src/engines/edgeV2/template/modules/goalModule/template/children';
import { edge } from '../../src/engines/edge/definition';
import * as edgeMapper from '../../src/engines/edge/mapper';
import { edgeV2 } from '../../src/engines/edgeV2/definition';
import * as edgeV2Mapper from '../../src/engines/edgeV2/mapper';
import { edgeCheckRegistry } from '../../src/engines/edgeFamily/checks';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const same = <T extends true>(): T => true as T;

// the hand-written key lists the definitions replaced (main @ 34ba682)
type Goal =
  | 'root'
  | 'maxRetries'
  | 'utility'
  | 'cost'
  | 'dependsOn'
  | 'variables'
  | 'type'
  | 'maintain'
  | 'assertion';
type Task = 'maxRetries' | 'type' | 'assertion' | 'utility' | 'cost';
type Resource = 'type' | 'initialValue' | 'lowerBound' | 'upperBound';

describe('engine definitions in lib', () => {
  it('keeps the mappers literal key types', () => {
    same<Same<edgeMapper.EdgeGoalKey, Goal>>();
    same<Same<edgeMapper.EdgeTaskKey, Task>>();
    same<Same<edgeMapper.EdgeResourceKey, Resource>>();
    same<Same<edgeV2Mapper.EdgeGoalKey, Goal>>();
    same<Same<edgeV2Mapper.EdgeTaskKey, Task>>();
    same<Same<edgeV2Mapper.EdgeResourceKey, Resource>>();
  });

  it('reads the same keys as the hand-written lists did', () => {
    const sorted = (keys: readonly string[]) => [...keys].sort();
    for (const mapper of [edgeMapper, edgeV2Mapper]) {
      assert.deepStrictEqual(
        sorted(mapper.EDGE_GOAL_KEYS),
        sorted([
          'root',
          'maxRetries',
          'utility',
          'cost',
          'dependsOn',
          'variables',
          'type',
          'maintain',
          'assertion',
        ]),
      );
      assert.deepStrictEqual(
        sorted(mapper.EDGE_TASK_KEYS),
        sorted(['maxRetries', 'type', 'assertion', 'utility', 'cost']),
      );
      assert.deepStrictEqual(
        sorted(mapper.EDGE_RESOURCE_KEYS),
        sorted(['type', 'initialValue', 'lowerBound', 'upperBound']),
      );
    }
  });

  it('types the execution detail with the definition’s names', () => {
    // a goal's construct is one of its definition's, its modifiers too
    same<Same<EdgeV2Detail['type'], ConstructOf<typeof edgeV2>>>();
    same<Same<EdgeDetail['type'], ConstructOf<typeof edge>>>();
    same<Same<keyof EdgeV2Detail['modifiers'], 'retry'>>();
    same<Same<Construct | 'decisionMaking', ConstructOf<typeof edgeV2>>>();
    // a misspelt construct or modifier does not compile
    const check = (detail: EdgeV2Detail) => [
      // @ts-expect-error not a construct of edgeV2
      detail.type === 'sequense',
      // @ts-expect-error not a modifier of edgeV2
      detail.modifiers.retires,
    ];
    void check;
    // the reader derived from a definition gives its typed detail
    const read = goalNameParserFor(edgeV2)({ goalText: 'G1: A [G2;G3]' });
    same<Same<NonNullable<typeof read.executionDetail>, EdgeV2Detail>>();
    assert.strictEqual(read.executionDetail?.type, 'sequence');
  });

  it('implements every check the definitions name', () => {
    same<Same<keyof typeof edgeCheckRegistry, CheckNameOf<typeof edgeV2>>>();
    for (const definition of [edge, edgeV2]) {
      for (const list of Object.values(definition.properties)) {
        for (const property of list as readonly { check?: string }[]) {
          if (property.check)
            assert.strictEqual(
              typeof (edgeCheckRegistry as Record<string, unknown>)[
                property.check
              ],
              'function',
              property.check,
            );
        }
      }
    }
  });
});
