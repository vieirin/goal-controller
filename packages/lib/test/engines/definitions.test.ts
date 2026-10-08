import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
  edge,
  edgeV2,
  type CheckNameOf,
  type ConstructOf,
} from '@goal-controller/definitions';
import type { GoalExecutionDetail } from '@goal-controller/goal-tree';
import * as edgeMapper from '../../src/engines/edge/mapper';
import * as edgeV2Mapper from '../../src/engines/edgeV2/mapper';
import { edgeCheckRegistry } from '../../src/engines/edgeChecks';

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

  it('declares exactly goal-tree constructs', () => {
    same<Same<ConstructOf<typeof edgeV2>, GoalExecutionDetail['type']>>();
    same<Same<ConstructOf<typeof edge>, GoalExecutionDetail['type']>>();
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
