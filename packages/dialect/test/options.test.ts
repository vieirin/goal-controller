/** An engine's options, typed as properties are (src/options.ts, goal-controller#118). */
import { expect } from 'chai';
import {
  defineOptions,
  isOptionValue,
  optionDefaults,
  optionsSummary,
  type OptionValues,
} from '../src';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const same = <T extends true>(): T => true as T;

const toyOptions = defineOptions([
  {
    key: 'depth',
    label: 'Depth',
    value: { type: 'int', min: 1, max: 9 },
    default: 3,
    summary: 'depth {value}',
  },
  { key: 'weight', label: 'Weight', value: { type: 'number' }, default: 0.5 },
  {
    key: 'shape',
    label: 'Shape',
    value: {
      type: 'enum',
      options: [
        { value: 'flat', label: 'Flat' },
        { value: 'deep', label: 'Deep', help: 'one module per level' },
      ],
    },
    default: 'flat',
    summary: '{value}',
  },
  {
    key: 'trim',
    label: 'Trim',
    value: { type: 'bool' },
    default: false,
    summary: 'trimmed',
    confirm: { text: ['It trims.'], action: 'Trim' },
  },
]);

describe('defineOptions', () => {
  it('types each option’s value by its declaration', () => {
    same<
      Same<
        OptionValues<(typeof toyOptions)[number]>,
        { depth: number; weight: number; shape: 'flat' | 'deep'; trim: boolean }
      >
    >();
    expect(optionDefaults(toyOptions)).to.deep.equal({
      depth: 3,
      weight: 0.5,
      shape: 'flat',
      trim: false,
    });
  });

  it('rejects a key declared twice, and a default the option doesn’t take', () => {
    const bool = {
      label: 'B',
      value: { type: 'bool' },
      default: false,
    } as const;
    expect(() =>
      defineOptions([
        { key: 'b', ...bool },
        { key: 'b', ...bool },
      ]),
    ).to.throw('option b: twice');
    expect(() =>
      defineOptions([
        { key: 'n', label: 'N', value: { type: 'int', min: 1 }, default: 0 },
      ]),
    ).to.throw('option n: its default 0 is not one of its values');
  });
});

describe('isOptionValue', () => {
  const [depth, weight, shape, trim] = toyOptions;
  it('takes a value of the option’s type, within its bounds or options', () => {
    expect(
      [1, 9, 0, 10, 2.5, '3'].map((v) => isOptionValue(depth, v)),
    ).to.deep.equal([true, true, false, false, false, false]);
    expect(
      [0.1, 7, Number.NaN, '1'].map((v) => isOptionValue(weight, v)),
    ).to.deep.equal([true, true, false, false]);
    expect(
      ['deep', 'round', 1].map((v) => isOptionValue(shape, v)),
    ).to.deep.equal([true, false, false]);
    expect([true, 'true', 1].map((v) => isOptionValue(trim, v))).to.deep.equal([
      true,
      false,
      false,
    ]);
  });
});

describe('optionsSummary', () => {
  it('says each option with a summary: its value, an enum’s label, a bool only when on', () => {
    expect(optionsSummary(toyOptions, {})).to.equal('depth 3 · Flat');
    expect(
      optionsSummary(toyOptions, { depth: 5, shape: 'deep', trim: true }),
    ).to.equal('depth 5 · Deep · trimmed');
  });
});
