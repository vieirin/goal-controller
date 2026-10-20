/**
 * The generation gate (goal-controller#274): an engine does not generate
 * from a model whose dialect reports an error on a property it reads, as
 * Problems shows it; warnings, and the defaults an engine intends, go on.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { parsePistar } from '../../../goal-tree/node_modules/@istar-ts/core';
import { defineDialect } from '@goal-controller/dialect';
import {
  defineEngine,
  propertyErrors,
  refuseOnPropertyErrors,
} from '../../src/engines/engine';
import { edgeEngine, kaosdocEngine, sleecEngine } from '../../src';

type El = {
  id: string;
  text: string;
  type: string;
  customProperties?: Record<string, string>;
};

/** A piStar file with one actor holding `nodes`, G1 refined by the others. */
const model = (nodes: El[]) =>
  parsePistar({
    actors: [
      {
        id: 'A',
        text: 'Actor',
        type: 'istar.Actor',
        x: 0,
        y: 0,
        nodes: nodes.map((n, i) => ({ ...n, x: 10 * i, y: 10 })),
      },
    ],
    orphans: [],
    dependencies: [],
    links: nodes.slice(1).map((n) => ({
      id: `l${n.id}`,
      type: 'istar.AndRefinementLink',
      source: n.id,
      target: nodes[0]!.id,
    })),
    display: {},
    tool: 'pistar.2.1.0',
    istar: '2.0',
    saveDate: '',
    diagram: { width: 100, height: 100 },
  });

const goal = (
  id: string,
  text: string,
  props: Record<string, string> = {},
) => ({
  id: `e${id}`,
  text: `${id}: ${text}`,
  type: 'istar.Goal',
  customProperties: props,
});
const task = (id: string, props: Record<string, string> = {}) => ({
  id: `e${id}`,
  text: `${id}: task`,
  type: 'istar.Task',
  customProperties: props,
});

const edgeModel = (props: Record<string, string>) =>
  model([goal('G1', 'root [T1]', props), task('T1')]);

describe('the generation gate (#274)', () => {
  it('has no error on a model the dialect reads whole', () => {
    const fine = edgeModel({ maxRetries: '2' });
    assert.deepStrictEqual(propertyErrors(edgeEngine, fine), []);
    refuseOnPropertyErrors(edgeEngine, fine);
  });

  it('refuses a value the dialect cannot read, naming its element and key', () => {
    for (const maxRetries of ['abc', '-1']) {
      const wrong = edgeModel({ maxRetries });
      const errors = propertyErrors(edgeEngine, wrong);
      assert.deepStrictEqual(
        errors.map(({ elementId, key, severity }) => ({
          elementId,
          key,
          severity,
        })),
        [{ elementId: 'G1', key: 'maxRetries', severity: 'error' }],
        maxRetries,
      );
      assert.throws(
        () => refuseOnPropertyErrors(edgeEngine, wrong),
        /^Error: Edge does not generate from a model with an error on a property it reads: G1 maxRetries: .*\(node G1\)/,
      );
    }
  });

  it('refuses a reference to no element, which reads as unset', () => {
    const dangling = edgeModel({ dependsOn: 'G99' });
    assert.deepStrictEqual(
      propertyErrors(edgeEngine, dangling).map((error) => error.key),
      ['dependsOn'],
    );
    assert.throws(
      () => refuseOnPropertyErrors(edgeEngine, dangling),
      /G1 dependsOn/,
    );
  });

  it('lists every error, and says how many more than the first', () => {
    const wrong = model([
      goal('G1', 'root [T1;T2]', { maxRetries: 'abc' }),
      task('T1', { maxRetries: 'x' }),
      task('T2', { maxRetries: 'y' }),
    ]);
    assert.throws(
      () => refuseOnPropertyErrors(edgeEngine, wrong),
      (error: Error) => {
        const [first, ...rest] = error.message.split('\n');
        assert.match(first!, /\(and 2 more, in Problems\)$/);
        assert.deepStrictEqual(
          rest.map((line) => line.split(':')[0]),
          ['- G1 maxRetries', '- T1 maxRetries', '- T2 maxRetries'],
        );
        return true;
      },
    );
  });

  it('goes on with a warning: a property set where it is not read', () => {
    const warned = edgeModel({ maintain: 'x > 1' });
    assert.deepStrictEqual(propertyErrors(edgeEngine, warned), []);
  });

  it('has none for an engine without a dialect, or of another framework', () => {
    const wrong = edgeModel({ maxRetries: 'abc' });
    assert.deepStrictEqual(propertyErrors(sleecEngine, wrong), []);
    assert.deepStrictEqual(propertyErrors(kaosdocEngine, wrong), []);
  });

  describe('an engine that intends a default', () => {
    const toy = defineDialect({
      id: 'toy',
      name: 'Toy',
      elements: {
        goal: { prefix: 'G', fill: '#fff' },
        task: { prefix: 'T', fill: '#fff' },
      },
      defaultFill: '#fff',
      properties: {
        goal: [
          {
            key: 'weight',
            value: { type: 'int' },
            help: 'w',
            check: 'toy.weight',
          },
          { key: 'size', value: { type: 'int' }, help: 's' },
        ],
        task: [],
        resource: [],
        quality: [],
      },
      propertyLineOrder: ['weight', 'size'],
      indent: '  ',
      problems: {
        notAChild: { severity: 'error', message: '' },
        missingFromNotation: { severity: 'warning', message: '' },
        relationMismatch: { severity: 'error', message: '' },
        notInDiagram: { severity: 'error', message: '' },
      },
    });
    const engine = (intendedDefaults: readonly string[] = []) =>
      defineEngine({
        id: 'toy',
        help: 'a toy',
        dialect: toy,
        checks: {
          'toy.weight': ({ props }: { props: { weight?: unknown } }) =>
            props.weight === 7 ? 'seven is not a weight' : null,
        },
        mapper: {},
        output: { label: 'Toy', extension: 'toy', language: 'text' },
        intendedDefaults,
      });
    const toyModel = model([goal('G1', 'root', { weight: '7', size: 'big' })]);

    it('refuses on its named checks too', () => {
      assert.deepStrictEqual(
        propertyErrors(engine(), toyModel).map(({ key, message }) => ({
          key,
          message,
        })),
        [
          { key: 'weight', message: 'seven is not a weight' },
          {
            key: 'size',
            message: propertyErrors(engine(), toyModel)[1]!.message,
          },
        ],
      );
    });

    it('goes on for the properties it lists as intended defaults', () => {
      assert.deepStrictEqual(
        propertyErrors(engine(['goal.size']), toyModel).map((e) => e.key),
        ['weight'],
      );
      assert.deepStrictEqual(
        propertyErrors(engine(['goal.size', 'goal.weight']), toyModel),
        [],
      );
    });

    it('rejects an intended default its dialect does not declare', () => {
      assert.throws(
        () => engine(['goal.height']),
        /^Error: toy: intendedDefaults names goal\.height, not a property of its dialect$/,
      );
      assert.throws(
        () => engine(['task.weight']),
        /intendedDefaults names task\.weight/,
      );
    });
  });
});
