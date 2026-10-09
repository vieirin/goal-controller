/** What is derived from a definition: constructs, properties, specs. */
import { expect } from 'chai';
import {
  constructDefinition,
  constructOf,
  constructsWith,
  evaluateCondition,
  fillOf,
  inputOf,
  propertyKeys,
  relationMismatch,
  specsFromDefinition,
} from '../src';
import { toy } from './support/toy';

describe('constructs', () => {
  it('reads constructs and relations', () => {
    expect(constructOf(toy, '|')).to.equal('fallback');
    expect(constructOf(toy, '*')).to.equal('any');
    expect(constructOf(toy, '@')).to.equal(null);
    expect(constructsWith(toy, 'and')).to.deep.equal(['sequence']);
    expect(constructsWith(toy, 'or')).to.deep.equal(['fallback']);
    expect(relationMismatch(toy, 'sequence', 'and')).to.equal(null);
    expect(relationMismatch(toy, 'any', 'or')).to.equal(null);
    expect(relationMismatch(toy, 'sequence', 'or')).to.equal(
      'Sequence needs AND, has OR',
    );
    expect(constructDefinition(toy, 'fallback')?.relation).to.equal('or');
    expect(constructDefinition(toy, 'nope')).to.equal(undefined);
  });
});

describe('properties', () => {
  it('lists the keys per kind', () => {
    const goal: readonly ('priority' | 'deadline' | 'hidden')[] = propertyKeys(
      toy,
      'goal',
    );
    expect(goal).to.deep.equal(['priority', 'deadline', 'hidden']);
    expect(propertyKeys(toy, 'quality')).to.deep.equal([]);
  });

  it('evaluates conditions', () => {
    const when = { when: { key: 'type', equals: 'int' } } as const;
    expect(evaluateCondition(when, { type: 'int' }, false)).to.equal(true);
    expect(evaluateCondition(when, {}, false)).to.equal(false);
    expect(evaluateCondition({ not: when }, {}, false)).to.equal(true);
    expect(evaluateCondition('always', {}, false)).to.equal(true);
    expect(evaluateCondition(undefined, {}, true)).to.equal(true);
  });

  it('falls back to the default fill', () => {
    expect(fillOf(toy, 'resource')).to.equal('#FFFF00');
    expect(fillOf(toy, 'goal')).to.equal('#00FF00');
    expect(fillOf(toy, 'nope')).to.equal('#FFFFFF');
  });

  it('builds specs, binding checks by name', () => {
    const calls: string[] = [];
    type Check = (properties: object, context: object) => string | null;
    const registry: Record<string, Check> = {
      'toy.goal.deadline': () => (calls.push('deadline'), null),
      'toy.resource.bounds': () => (calls.push('bounds'), 'out of bounds'),
    };
    const specs = specsFromDefinition(toy, registry);
    expect(specs.goal.map((s) => s.key)).to.deep.equal([
      'priority',
      'deadline',
    ]);
    const initial = specs.resource.find((s) => s.key === 'initialValue')!;
    expect(inputOf(initial, { type: 'int' })).to.deep.equal({
      kind: 'integer',
    });
    expect(inputOf(initial, { type: 'bool' }).kind).to.equal('select');
    const low = specs.resource.find((s) => s.key === 'lowerBound')!;
    expect(low.notApplying!({})).to.equal(
      'Bounds are for int resources (type is unset)',
    );
    expect(low.validate!({}, { self: 'R1', kindOf: () => undefined })).to.equal(
      'out of bounds',
    );
    expect(calls).to.deep.equal(['bounds']);
    expect(() => specsFromDefinition(toy, {})).to.throw(/no check named/);
  });
});
