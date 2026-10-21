/**
 * Properties on an extension's own kinds, and references to them
 * (goal-controller#132): `properties` keyed by the dialect's extension's
 * node kinds beside iStar's, typed from the extension it names and checked
 * at run time; references and lines naming them; what is derived from them.
 */
import { expect } from 'chai';
import {
  defineDialect,
  extensionKindsRead,
  isExtensionIdPrefix,
  propertyKeys,
  specsFromDefinition,
  type AnyDialect,
  type CheckNameOf,
  type PropertyKeyOf,
  type PropertyKindOf,
} from '../src';
import { sensed, sensing, toy } from './support/toy';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const same = <T extends true>(): T => true as T;

/** `sensed` changed, as a definition no type checks (what defineDialect checks at run time). */
const changed = (change: (d: AnyDialect) => AnyDialect) => (): unknown =>
  defineDialect(change(structuredClone(sensed) as AnyDialect));

describe('properties on an extension’s kinds (#132)', () => {
  it('keys them by kind id, typed from the extension the dialect names', () => {
    same<
      Same<
        PropertyKeyOf<typeof sensed, 'sensing.Sensor'>,
        'rate' | 'feeds' | 'level'
      >
    >();
    // its checks are the dialect's, with its iStar kinds'
    same<
      Same<
        CheckNameOf<typeof sensed>,
        'toy.goal.deadline' | 'toy.resource.bounds' | 'toy.sensor.rate'
      >
    >();
    // the kinds it may give properties: iStar's, its extension's nodes (not its actors)
    same<
      Same<
        PropertyKindOf<typeof sensed>,
        | 'goal'
        | 'task'
        | 'resource'
        | 'quality'
        | 'sensing.Sensor'
        | 'sensing.Display'
      >
    >();
    expect(propertyKeys(sensed, 'sensing.Sensor')).to.deep.equal([
      'rate',
      'feeds',
      'level',
    ]);
  });

  it('doesn’t compile a key that is none of its kinds', () => {
    const base = { ...toy, id: 'typo', extension: sensing } as const;
    expect(() =>
      defineDialect({
        ...base,
        properties: {
          ...toy.properties,
          // @ts-expect-error: not a kind of its extension
          'sensing.Sensr': [],
        },
      }),
    ).to.throw(/properties: sensing.Sensr is neither/);
    expect(() =>
      defineDialect({
        ...base,
        properties: {
          ...toy.properties,
          // @ts-expect-error: an actor kind's properties are `actors`'
          'sensing.Operator': [],
        },
      }),
    ).to.throw(/properties: sensing.Operator is neither/);
    expect(() =>
      defineDialect({
        ...toy,
        id: 'none',
        properties: {
          ...toy.properties,
          // @ts-expect-error: a dialect without an extension has none
          'sensing.Sensor': [],
        },
      }),
    ).to.throw(/properties: sensing.Sensor is neither/);
  });

  it('gives a kind without an entry none', () => {
    expect(sensed.properties).to.not.have.property('sensing.Display');
    const specs = specsFromDefinition(sensed, {
      'toy.goal.deadline': 'deadline',
      'toy.resource.bounds': 'bounds',
      'toy.sensor.rate': 'rate',
    });
    expect(specs).to.not.have.property('sensing.Display');
  });

  it('derives an extension kind’s inspector specs as a goal’s, its checks bound', () => {
    const specs = specsFromDefinition(sensed, {
      'toy.goal.deadline': 'deadline',
      'toy.resource.bounds': 'bounds',
      'toy.sensor.rate': 'rate',
    });
    expect(
      specs['sensing.Sensor']!.map(({ key, input, validate }) => ({
        key,
        input,
        validate,
      })),
    ).to.deep.equal([
      { key: 'rate', input: { kind: 'number' }, validate: 'rate' },
      { key: 'feeds', input: { kind: 'text' }, validate: undefined },
      { key: 'level', input: { kind: 'long' }, validate: undefined },
    ]);
  });

  it('says which of its extension’s kinds it reads: listed, with properties, or referenced', () => {
    expect(extensionKindsRead(sensed)).to.deep.equal([
      'sensing.Sensor',
      'sensing.Display',
    ]);
    expect(extensionKindsRead(toy)).to.deep.equal([]);
  });

  it('rejects a reference to a kind it doesn’t have', () => {
    expect(
      changed((d) => ({
        ...d,
        properties: {
          ...d.properties,
          'sensing.Sensor': [
            {
              key: 'feeds',
              value: { type: 'refList', kind: 'sensing.Gauge' },
              help: 'x',
            },
          ],
        },
        propertyLineOrder: d.propertyLineOrder.filter(
          (key) => key !== 'rate' && key !== 'level',
        ),
      })),
    ).to.throw(/sensing.Sensor.feeds names unknown kind sensing.Gauge/);
    expect(
      changed((d) => ({
        ...d,
        properties: {
          ...d.properties,
          task: [
            {
              key: 'guard',
              value: {
                type: 'assertion',
                resolves: ['sensing.Operator', 'variable'],
              },
              help: 'x',
            },
          ],
        },
        propertyLineOrder: d.propertyLineOrder.filter(
          (key) => key !== 'robot' && key !== 'after',
        ),
      })),
    ).to.throw(/task.guard names unknown kind sensing.Operator/);
    expect(
      changed((d) => ({
        ...d,
        notation: {
          ...d.notation!,
          operand: { kinds: ['goal', 'sensing.Gauge'] },
        },
      })),
    ).to.throw(/operand kind sensing.Gauge is unknown/);
  });

  it('lists an extension kind with a prefix of its own: one or two capitals, none of the goal language’s', () => {
    expect(['S', 'EF'].map(isExtensionIdPrefix)).to.deep.equal([true, true]);
    expect(
      ['G', 'T', 'R', 'AT', 'X', 'W', 's', 'S1', 'ABC', ''].map(
        isExtensionIdPrefix,
      ),
    ).to.deep.equal(Array(10).fill(false));
    const prefixed = (kind: string, prefix: string) =>
      changed((d) => ({
        ...d,
        elements: {
          ...d.elements,
          [kind]: { ...d.elements[kind], prefix, fill: '#000000' },
        },
      }));
    expect(prefixed('sensing.Sensor', 'G')).to.throw(
      /sensing.Sensor: its prefix is one or two capitals, none of G, T, R, AT, X, W \(not G\)/,
    );
    expect(prefixed('sensing.Sensor', 'X')).to.throw(/\(not X\)/);
    expect(prefixed('sensing.Display', 'S')).to.throw(
      /sensing.(Sensor|Display): prefix S is another kind’s/,
    );
    expect(prefixed('goal', 'S')).to.throw(
      /goal: S is not one of the goal language’s prefixes/,
    );
    // a kind its extension doesn't have can't be listed
    expect(prefixed('sensing.Gauge', 'Q')).to.throw(
      /elements: sensing.Gauge is not a node kind of its extension/,
    );
    // nor its actor kinds
    expect(prefixed('sensing.Operator', 'O')).to.throw(
      /elements: sensing.Operator is not a node kind of its extension/,
    );
  });

  it('writes a listed kind’s keys on its property lines, in the one order', () => {
    expect(
      changed((d) => ({
        ...d,
        propertyLineOrder: d.propertyLineOrder.filter((key) => key !== 'rate'),
      })),
    ).to.throw(/propertyLineOrder must list each listed kind key once/);
  });
});
