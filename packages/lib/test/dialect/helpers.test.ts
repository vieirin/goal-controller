/**
 * The definitions written with the dialect helpers (`property.*`, `element`,
 * `notation`, `links`, `actors`, `extensionKind`, …) are what they were as
 * hand-written literals: `fixtures/literal` holds each one as it was before
 * the helpers (goal-controller#124), and each must deep-equal it, its keys in
 * the same order.
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  edge,
  edgeV2,
  goda,
  grl,
  grlExtension,
  istar4RationalAgents,
  mutrose,
} from '../../src';

const LITERAL = join(__dirname, 'fixtures/literal');

const DEFINITIONS = {
  edge,
  edgeV2,
  mutrose,
  goda,
  grl,
  grlExtension,
  istar4RationalAgents,
};

describe('definitions written with the helpers', () => {
  for (const [name, definition] of Object.entries(DEFINITIONS))
    it(`${name} is its hand-written literal`, () => {
      const text = readFileSync(join(LITERAL, `${name}.json`), 'utf8');
      expect(definition).to.deep.equal(JSON.parse(text));
      // the same keys in the same order: what is written of it stays byte for byte
      expect(JSON.stringify(definition)).to.equal(
        JSON.stringify(JSON.parse(text)),
      );
    });
});
