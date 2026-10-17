/**
 * The workbench loads one @istar-ts/core (goal-controller#171): goal-tree's
 * `out/` requires it as CommonJS while the UI imports it. Two copies read
 * every model the UI parsed as plain iStar 2.0 before istar-ts 0.13.5 shared
 * core's registries, and still hold two ISTAR_2_0s and the like.
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import * as core from '@istar-ts/core';
import { goalView } from '@goal-controller/goal-tree';
import { notationDefinitionOf } from '@/lib/workbench/engineDialects';

const MINIMAL = join(__dirname, '../../../../examples/pistar-ext/minimal.txt');

describe('one @istar-ts/core', () => {
  it('is the one goal-tree requires', () => {
    const goalTree = createRequire(
      require.resolve('@goal-controller/goal-tree'),
    );
    expect(goalTree('@istar-ts/core').metamodelOf).toBe(core.metamodelOf);
  });

  it('so goalView sees the actors of an extension the UI parsed', () => {
    const json = JSON.parse(readFileSync(MINIMAL, 'utf8'));
    json.actors[0].type = 'ext.Robot';
    json.metamodel = {
      name: 'ext',
      elements: [{ kind: 'ext.Robot', category: 'actor' }],
    };
    const model = core.parsePistar(json, { fileMetamodel: true });
    const view = goalView(model as never, notationDefinitionOf('edge'));
    expect(view.actors.map((actor) => actor.kind)).toEqual(['ext.Robot']);
  });
});
