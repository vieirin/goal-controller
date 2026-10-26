/**
 * `@goal-controller/dialect`'s own copy of `@istar-ts/react`'s `LINE_DASHES`
 * (packages/dialect/src/derive/extensions.ts's `DASH_OF`, goal-controller#457):
 * it has no dependency on `@istar-ts/react`, so a drift between the two would
 * otherwise only show up as a wrongly drawn line. This package depends on
 * both, so it is where the two copies can be compared directly.
 */
import { describe, expect, it } from 'vitest';
import { DASH_OF } from '@goal-controller/dialect';
import { LINE_DASHES } from '@istar-ts/react';

describe('the dialect’s own dash mapping, against @istar-ts/react’s LINE_DASHES (#457)', () => {
  it('is the same raw SVG dash array for every dash key', () => {
    expect(Object.keys(DASH_OF).sort()).toEqual(
      Object.keys(LINE_DASHES).sort(),
    );
    for (const dash of Object.keys(DASH_OF) as (keyof typeof DASH_OF)[])
      expect(DASH_OF[dash], dash).toEqual(LINE_DASHES[dash]);
  });
});
