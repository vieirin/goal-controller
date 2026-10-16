/**
 * The helpers a definition is written with (src/helpers.ts): each builds the
 * object a hand-written literal is, its literal types kept, and rejects a
 * misspelt option where it is written.
 */
import { expect } from 'chai';
import {
  actors,
  defineDialect,
  element,
  extensionKind,
  extensionLink,
  links,
  notation,
  property,
  type CheckNameOf,
  type PropertyKeyOf,
} from '../src';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const same = <T extends true>(): T => true as T;

describe('property', () => {
  it('builds each value type as the literal, only the options given set', () => {
    expect(property.int('retries', { min: 0, help: 'h' })).to.deep.equal({
      key: 'retries',
      value: { type: 'int', min: 0 },
      help: 'h',
    });
    expect(
      property.text('name', { help: 'h', inspector: false }),
    ).to.deep.equal({
      key: 'name',
      value: { type: 'text' },
      help: 'h',
      inspector: false,
    });
    expect(property.number('cost', { help: 'h' }).value).to.deep.equal({
      type: 'number',
    });
    expect(property.bool('on', { help: 'h' }).value).to.deep.equal({
      type: 'bool',
    });
    expect(property.annotatedName('a', { help: 'h' }).value).to.deep.equal({
      type: 'annotatedName',
    });
    expect(
      property.refList('dependsOn', 'goal', { help: 'h', check: 'c' }),
    ).to.deep.equal({
      key: 'dependsOn',
      value: { type: 'refList', kind: 'goal' },
      help: 'h',
      check: 'c',
    });
    expect(property.pairList('vars', 'int', { help: 'h' }).value).to.deep.equal(
      { type: 'pairList', value: 'int' },
    );
  });

  it('writes an enum option as its own label, or as [value, label]', () =>
    expect(
      property.enum('type', ['', ['maintain', 'Maintain']], {
        open: true,
        help: 'h',
      }),
    ).to.deep.equal({
      key: 'type',
      value: {
        type: 'enum',
        options: [
          { value: '', label: '' },
          { value: 'maintain', label: 'Maintain' },
        ],
        open: true,
      },
      help: 'h',
    }));

  it('writes an enumSet’s options as an enum’s (#162)', () =>
    expect(
      property.enumSet('days', ['mon', ['wed', 'Wednesday']], { help: 'h' }),
    ).to.deep.equal({
      key: 'days',
      value: {
        type: 'enumSet',
        options: [
          { value: 'mon', label: 'mon' },
          { value: 'wed', label: 'Wednesday' },
        ],
      },
      help: 'h',
    }));

  it("puts an assertion's, an expression's and OCL's options in the value, the rest beside it", () => {
    const functions = [{ name: 'previous', arity: 1 }];
    expect(
      property.assertion('when', {
        resolves: ['variable'],
        prefixes: ['assertion trigger'],
        functions,
        input: { placeholder: 'p' },
        help: 'h',
      }),
    ).to.deep.equal({
      key: 'when',
      value: {
        type: 'assertion',
        resolves: ['variable'],
        prefixes: ['assertion trigger'],
        functions,
      },
      input: { placeholder: 'p' },
      help: 'h',
    });
    expect(
      property.expression('rate', { resolves: ['task'], functions, help: 'h' })
        .value,
    ).to.deep.equal({ type: 'expression', resolves: ['task'], functions });
    expect(
      property.ocl('Params', { declaredBy: ['Controls'], help: 'h' }).value,
    ).to.deep.equal({ type: 'ocl', declaredBy: ['Controls'] });
  });

  it('takes a conditional value as written', () => {
    const value = {
      when: { key: 'type', equals: 'int' },
      matching: { type: 'int' },
      otherwise: { type: 'bool' },
    } as const;
    expect(property.conditional('initial', value, { help: 'h' })).to.deep.equal(
      { key: 'initial', value, help: 'h' },
    );
  });

  it("keeps the literal types: a definition's keys and check names are read from them", () => {
    const { int, text } = property.for<'toy.weight' | 'toy.name'>();
    const toy = defineDialect({
      id: 'toy',
      name: 'Toy',
      elements: { goal: element('G', { fill: '#fff' }) },
      defaultFill: '#fff',
      properties: {
        goal: [
          int('weight', { min: 0, help: 'h', check: 'toy.weight' }),
          text('label', { help: 'h' }),
        ],
        task: [],
        resource: [],
        quality: [],
      },
      propertyLineOrder: ['weight', 'label'],
      indent: '  ',
      problems: {
        notAChild: { severity: 'error', message: '' },
        missingFromNotation: { severity: 'warning', message: '' },
        relationMismatch: { severity: 'error', message: '' },
        notInDiagram: { severity: 'error', message: '' },
      },
    });
    same<Same<PropertyKeyOf<typeof toy, 'goal'>, 'weight' | 'label'>>();
    same<Same<CheckNameOf<typeof toy>, 'toy.weight'>>();
    same<Same<typeof toy.elements.goal.prefix, 'G'>>();
  });

  it("doesn't compile a misspelt option, a check not among the names, or a missing help", () => {
    // @ts-expect-error `mn` is no option of an int
    property.int('a', { mn: 1, help: 'h' });
    // @ts-expect-error a check outside the engine's names
    property.for<'toy.weight'>().int('a', { help: 'h', check: 'toy.wieght' });
    // @ts-expect-error help is required
    property.text('a', {});
  });
});

describe('element, notation, links, actors, extensionKind', () => {
  it('build the literals', () => {
    expect(element('R', { fill: '#ff0', declares: true })).to.deep.equal({
      prefix: 'R',
      fill: '#ff0',
      declares: true,
    });
    expect(element({ fill: '#fff' })).to.deep.equal({ fill: '#fff' });
    const contribution = [property.int('weight', { help: 'h' })];
    expect(links({ 'istar.ContributionLink': contribution })).to.deep.equal({
      'istar.ContributionLink': contribution,
    });
    expect(actors(contribution)).to.equal(contribution);
    expect(
      extensionKind('toy.Box', { category: 'node', label: 'Box' }),
    ).to.deep.equal({ kind: 'toy.Box', category: 'node', label: 'Box' });
    expect(
      extensionLink('toy.Link', { behavesLike: 'istar.DependencyLink' }),
    ).to.deep.equal({ kind: 'toy.Link', behavesLike: 'istar.DependencyLink' });
  });

  it("completes a notation's operators from the goal language's catalog", () => {
    const written = {
      operand: { kinds: ['goal'] },
      operators: { ';': 'sequence', DM: 'decide' },
      standalone: { '+': 'choice' },
      constructs: {
        sequence: { label: 'S', help: '' },
        decide: { label: 'D', help: '' },
        choice: { label: 'C', help: '' },
      },
      defaultConstruct: { and: 'sequence', or: 'choice' },
    } as const;
    expect(notation(written)).to.equal(written);
    notation({
      ...written,
      // @ts-expect-error `=>` is no operator of the goal language
      operators: { '=>': 'sequence' },
    });
  });
});
