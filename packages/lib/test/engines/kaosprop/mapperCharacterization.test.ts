/**
 * kaospropEngineMapper, characterized (goal-controller#187 phase 2): what
 * its IR holds of a KAOS model's links, and what the propagation makes of
 * it, so the migration to typed values can show nothing changed. The mapper
 * keeps each goal node's text and, of a link, its link keys as written;
 * the propagation reads a link's `Probability` (an obstruction's P(¬G|O), a
 * case-driven leg's P(CS)), a value that is no probability as unset.
 * Elements' quantities (`ESR`, an obstacle's `Probability`, a hub's) are read
 * off the model's elements, outside the mapper. Where the IR changes with
 * the dialect's reading of a link: `#187: invalid value` (no probability)
 * and `#187: link keys on the wrong kind`.
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it } from 'mocha';
import {
  kaospropAnalysisModel,
  propagateProbabilities,
  readKaosObstacleModel,
} from '../../../src/engines/kaosprop';

const LAS = readFileSync(join(__dirname, 'fixtures', 're12-las.txt'), 'utf8');

const OBSTRUCTION = 'obstruction-on-scene';
const OBSTRUCTED = 'achieve_ambulance_on_scene_when_ambulance_mobilized';
const LEG = 'case-mobilized-leg-1';
const OTHER_LEG = 'case-mobilized-leg-2';
const CASES = 'achieve_ambulance_mobilized_when_ambulance_allocated';
const ASSIGNMENT =
  'assignment-achieve_ambulance_on_scene_when_ambulance_mobilized';

type Link = { id?: string; customProperties?: Record<string, string> };
type Json = { links: (Link & { starts?: Link[]; end?: Link })[] };

/** LAS with custom properties replaced, by link id (a refinement's legs' too); `null` removes them. */
const withLinks = (
  properties: Record<string, Record<string, string> | null>,
): string => {
  const json = JSON.parse(LAS) as Json;
  for (const link of json.links.flatMap((l) => [
    l,
    ...(l.starts ?? []),
    ...(l.end ? [l.end] : []),
  ]))
    if (link.id && link.id in properties) {
      const set = properties[link.id];
      if (set) link.customProperties = set;
      else delete link.customProperties;
    }
  return JSON.stringify(json);
};

const modelOf = (text: string) =>
  kaospropAnalysisModel(readKaosObstacleModel(text));

const linkProperties = (text: string, id: string) => {
  const link = modelOf(text).links.find((l) => l.id === id);
  if (!link) throw new Error(`${id} is no link`);
  return link.properties;
};

const probabilityOf = (text: string, id: string) =>
  propagateProbabilities(modelOf(text)).probabilities.get(id)!;

const whyOf = (text: string, id: string) =>
  propagateProbabilities(modelOf(text)).steps.find((s) => s.id === id)!.why;

describe('kaospropEngineMapper: characterization (#187)', () => {
  describe('a link’s Probability', () => {
    it('a leg’s, kept; the propagation reads 0.4, .4 and 40% alike', () => {
      assert.deepStrictEqual(linkProperties(LAS, LEG), { Probability: '0.4' });
      const p = probabilityOf(LAS, CASES);
      for (const Probability of ['.4', '40%', ' 0.4 '])
        assert.strictEqual(
          probabilityOf(withLinks({ [LEG]: { Probability } }), CASES),
          p,
          Probability,
        );
    });

    it('an obstruction’s, read as P(¬G|O); a tiny one too', () => {
      assert.deepStrictEqual(
        linkProperties(
          withLinks({ [OBSTRUCTION]: { Probability: '0.5' } }),
          OBSTRUCTION,
        ),
        { Probability: '0.5' },
      );
      assert.ok(
        whyOf(
          withLinks({ [OBSTRUCTION]: { Probability: '0.5' } }),
          OBSTRUCTED,
        ).endsWith('× P(¬G|O) 0.5'),
      );
      assert.ok(
        whyOf(
          withLinks({ [OBSTRUCTION]: { Probability: '0.0000001' } }),
          OBSTRUCTED,
        ).endsWith('× P(¬G|O) 1e-7'),
      );
    });

    it('unset, blank or no probability: the default, P(¬G|O) 1, a leg’s case its complement', () => {
      const obstructed = probabilityOf(LAS, OBSTRUCTED);
      const cases = probabilityOf(LAS, CASES);
      for (const Probability of ['', '  ', 'often', '1.5', '-0.1']) {
        assert.strictEqual(
          probabilityOf(
            withLinks({ [OBSTRUCTION]: { Probability } }),
            OBSTRUCTED,
          ),
          obstructed,
          Probability,
        );
        // leg 1 unknown: 1 − leg 2's 0.6
        assert.strictEqual(
          probabilityOf(withLinks({ [LEG]: { Probability } }), CASES),
          cases,
          Probability,
        );
      }
      // both unknown: neither case counts
      assert.strictEqual(
        probabilityOf(
          withLinks({ [LEG]: null, [OTHER_LEG]: { Probability: 'x' } }),
          CASES,
        ),
        0,
      );
    });

    it('a blank one is kept as written', () => {
      // #187: invalid value (blank: unset)
      assert.deepStrictEqual(
        linkProperties(withLinks({ [LEG]: { Probability: '  ' } }), LEG),
        { Probability: '  ' },
      );
    });

    it('one that is no probability is kept as written', () => {
      // #187: invalid value
      assert.deepStrictEqual(
        linkProperties(
          withLinks({ [OBSTRUCTION]: { Probability: 'often' } }),
          OBSTRUCTION,
        ),
        { Probability: 'often' },
      );
    });
  });

  describe('link keys', () => {
    it('every link kind keeps every link key, as written, and no other', () => {
      // #187: link keys on the wrong kind
      assert.deepStrictEqual(
        linkProperties(
          withLinks({
            [ASSIGNMENT]: {
              BoundaryCondition: ' x ',
              Probability: '0.5',
              Tactic: 'case',
              Description: 'not a link key',
            },
          }),
          ASSIGNMENT,
        ),
        { BoundaryCondition: ' x ', Probability: '0.5' },
      );
      // #187: link keys on the wrong kind
      assert.deepStrictEqual(
        linkProperties(
          withLinks({
            [OBSTRUCTION]: {
              Probability: '0.5',
              ResolutionType: 'mitigation',
            },
          }),
          OBSTRUCTION,
        ),
        { Probability: '0.5', ResolutionType: 'mitigation' },
      );
    });

    it('a resolution’s keys, kept as written', () => {
      assert.deepStrictEqual(linkProperties(LAS, 'resolution-familiar-area'), {
        ResolutionType: 'mitigation',
        Anchor: 'achieve_ambulance_on_scene_when_ambulance_mobilized',
      });
    });

    it('a link with no properties has none', () => {
      assert.deepStrictEqual(linkProperties(LAS, ASSIGNMENT), {});
    });
  });
});
