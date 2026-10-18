/**
 * kaospropEngineMapper, characterized (goal-controller#187 / #215): what
 * its IR holds of a KAOS model's links and element quantities, and what
 * the propagation makes of them. The mapper keeps each goal node's text
 * and, of a link, the keys its kind has that the dialect reads as set, as
 * written; ESR, RSR and an obstacle's or hub's Probability arrive through
 * entries (goal-controller#244). The propagation reads a link's
 * `Probability` (an obstruction's P(¬G|O), a case-driven leg's P(CS)), a
 * value that is no probability as unset. Where the IR changed with the
 * dialect's reading of a link (until #187 a link kept every link key as
 * written): `#187: invalid value` (no probability, blank) and `#187: link
 * keys on the wrong kind`.
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
const ROOT = 'achieve_ambulance_on_scene_when_incident_reported';
const LEAF_ALLOCATED = 'achieve_ambulance_allocated_when_incident_reported';
const LEAF_OBSTACLE = 'ambulance_stuck_in_traffic_jam';

type Link = { id?: string; customProperties?: Record<string, string> };
type Element = { id?: string; customProperties?: Record<string, string> };
type Json = {
  orphans?: Element[];
  links: (Link & { starts?: Link[]; end?: Link })[];
};

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

/** LAS with an orphan's custom properties replaced (merged) or removed (`null`). */
const withElement = (
  id: string,
  properties: Record<string, string> | null,
): string => {
  const json = JSON.parse(LAS) as Json;
  const element = json.orphans?.find((e) => e.id === id);
  if (!element) throw new Error(`${id} is no orphan`);
  if (properties === null) delete element.customProperties;
  else
    element.customProperties = {
      ...element.customProperties,
      ...properties,
    };
  return JSON.stringify(json);
};

const modelOf = (text: string) =>
  kaospropAnalysisModel(readKaosObstacleModel(text));

const linkProperties = (text: string, id: string) => {
  const link = modelOf(text).links.find((l) => l.id === id);
  if (!link) throw new Error(`${id} is no link`);
  return link.properties;
};

const elementProperties = (text: string, id: string) => {
  const element = modelOf(text).elements.find((e) => e.id === id);
  if (!element) throw new Error(`${id} is no element`);
  return element.properties;
};

const probabilityOf = (text: string, id: string) =>
  propagateProbabilities(modelOf(text)).probabilities.get(id)!;

const whyOf = (text: string, id: string) =>
  propagateProbabilities(modelOf(text)).steps.find((s) => s.id === id)!.why;

describe('kaospropEngineMapper: characterization (#187)', () => {
  describe('element quantities through entries (goal-controller#244)', () => {
    it('a goal’s RSR and ESR as the dialect reads them', () => {
      assert.strictEqual(elementProperties(LAS, ROOT).RSR, '0.95');
      assert.strictEqual(elementProperties(LAS, LEAF_ALLOCATED).ESR, '0.98');
      // kept as written; blank or no probability unset (the dialect reports it)
      assert.strictEqual(
        elementProperties(withElement(ROOT, { RSR: ' 0.9 ' }), ROOT).RSR,
        ' 0.9 ',
      );
      assert.strictEqual(
        elementProperties(withElement(ROOT, { RSR: '  ' }), ROOT).RSR,
        undefined,
      );
      // #244: changed (was kept as written on the element); #187: invalid value
      assert.strictEqual(
        elementProperties(withElement(ROOT, { RSR: 'often' }), ROOT).RSR,
        undefined,
      );
    });

    it('a leaf obstacle’s Probability through its entry', () => {
      assert.strictEqual(
        elementProperties(LAS, LEAF_OBSTACLE).Probability,
        '0.02',
      );
      assert.strictEqual(
        elementProperties(
          withElement(LEAF_OBSTACLE, { Probability: 'often' }),
          LEAF_OBSTACLE,
        ).Probability,
        undefined,
      );
    });
  });

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

    it('a blank one is unset', () => {
      // #187: invalid value (blank: unset; was kept as written)
      assert.deepStrictEqual(
        linkProperties(withLinks({ [LEG]: { Probability: '  ' } }), LEG),
        {},
      );
    });

    it('one that is no probability is unset (the dialect reports it)', () => {
      // #187: invalid value (was kept as written)
      assert.deepStrictEqual(
        linkProperties(
          withLinks({ [OBSTRUCTION]: { Probability: 'often' } }),
          OBSTRUCTION,
        ),
        {},
      );
    });
  });

  describe('link keys', () => {
    it('a link keeps its kind’s keys only', () => {
      // #187: link keys on the wrong kind (every link kind kept every link key)
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
        {},
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
        { Probability: '0.5' },
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
