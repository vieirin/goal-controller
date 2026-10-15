/** The engines' generation options (goal-controller#118): what each declares. */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
  edgeOptions,
  edgeV2Options,
  GODA_DEFAULT_VARIANT,
  GODA_VARIANTS,
  godaOptions,
  sleecOptions,
} from '../../src';

describe('engine options', () => {
  it('offers GODA’s generator versions, the default one first', () => {
    const variant = godaOptions.find((o) => o.key === 'variant')!;
    assert.strictEqual(variant.value.type, 'enum');
    assert.deepStrictEqual(
      variant.value.options.map((o) => o.value).sort(),
      [...GODA_VARIANTS].sort(),
    );
    assert.strictEqual(variant.default, GODA_DEFAULT_VARIANT);
  });

  it('gives an option two engines read one default', () => {
    const all = [edgeOptions, edgeV2Options, godaOptions, sleecOptions].flat();
    for (const option of all)
      assert.deepStrictEqual(
        all.filter((o) => o.key === option.key).map((o) => o.default),
        all.filter((o) => o.key === option.key).map(() => option.default),
        option.key,
      );
  });
});
