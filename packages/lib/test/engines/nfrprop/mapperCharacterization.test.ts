/**
 * nfrpropEngineMapper, characterized (goal-controller#187 / #215): what it
 * and the propagation read of an NFR model's properties. Softgoals and
 * operationalizations are tree nodes; claims are `tree: false`. Each
 * element's `initialLabel` arrives through its entry when the dialect reads
 * it as a label (goal-controller#226); a value outside them is unset
 * (`#187: invalid value`).
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { describe, it } from 'mocha';
import { GoalTree } from '@goal-controller/goal-tree';
import {
  nfrpropAnalysisModel,
  nfrpropEngineMapper,
  propagateLabels,
  readNfrModel,
  type NfrpropNode,
} from '../../../src/engines/nfrprop';

const SEED = readFileSync('../../examples/nfr/nfr-welcome.txt', 'utf8');

const SECURITY = 'b79575b1-2b32-466b-bd0f-2f2f41cbcf41';
const AUTHENTICATION = 'c578c382-617b-4f83-9454-5f0019d759c1';
const USABILITY = 'ba10f8ed-95c2-4b35-b7da-9d31c4750a0e';
const RSA_260 = '1f16044e-7b7a-49c3-b8ac-8b3bb2410b3c'; // an operationalization
const CLAIM = '77371218-ae0f-4043-b500-9c75894788ee'; // Can be broken quickly
const CORRELATION = '475c8651'; // Authentication some+ Usability, by its id's start

type Json = {
  orphans: {
    id: string;
    text: string;
    customProperties?: Record<string, string>;
  }[];
  links: { id: string; label?: string }[];
};

const edit = (change: (json: Json) => void): string => {
  const json = JSON.parse(SEED) as Json;
  change(json);
  return JSON.stringify(json);
};

/** The seed with an element's custom properties replaced. */
const withProperties = (id: string, properties: Record<string, string>) =>
  edit((json) => {
    json.orphans.find((e) => e.id === id)!.customProperties = properties;
  });

const propagation = (text: string) =>
  propagateLabels(nfrpropAnalysisModel(readNfrModel(text)));

const labelOf = (text: string, id: string) => propagation(text).labels.get(id);

const stepOf = (text: string, id: string) =>
  propagation(text).steps.find((step) => step.id === id);

const goalModelOf = (text: string) =>
  GoalTree.goalModel(readNfrModel(text), nfrpropEngineMapper);

const flatten = (nodes: readonly NfrpropNode[]): NfrpropNode[] =>
  nodes.flatMap((node) => [
    node,
    ...('children' in node ? flatten(node.children ?? []) : []),
  ]);

describe('nfrpropEngineMapper: characterization (#187)', () => {
  describe('the mapper', () => {
    it('keeps each tree node’s text and its initialLabel when typed', () => {
      const text = edit((json) => {
        const security = json.orphans.find((e) => e.id === SECURITY)!;
        security.text = '  Security ';
        security.customProperties = {
          Description: 'd',
          initialLabel: 'denied',
        };
      });
      const nodes = flatten(goalModelOf(text).paper);
      const security = nodes.find((node) => node.iStarId === SECURITY)!;
      assert.deepStrictEqual(security.properties.engine, {
        text: '  Security ',
        initialLabel: 'denied',
      });
      const operationalization = nodes.find(
        (node) => node.iStarId === RSA_260,
      )!;
      assert.deepStrictEqual(operationalization.properties.engine, {
        text: 'Encrypt with RSA 260 bits',
      });
      // a claim argues a link: it is in no tree (tree: false)
      assert.ok(!nodes.some((node) => node.iStarId === CLAIM));
      assert.deepStrictEqual(
        goalModelOf(text).elements.find((e) => e.id === CLAIM)?.engine,
        { text: 'Can be broken quickly' },
      );
    });

    it('maps no link property; a link keeps its label', () => {
      const model = goalModelOf(SEED);
      for (const link of model.links)
        assert.deepStrictEqual(link.properties.engine, {});
      assert.strictEqual(
        model.links.find((link) => link.id.startsWith(CORRELATION))!.label,
        'some+',
      );
    });

    it('the analysis view reads initialLabel through the entry (#226)', () => {
      const text = withProperties(RSA_260, {
        initialLabel: ' denied ',
        Description: '',
      });
      // enum trims; the analysis overlay keeps the typed label
      assert.strictEqual(
        nfrpropAnalysisModel(readNfrModel(text)).elements.find(
          (e) => e.id === RSA_260,
        )!.properties.initialLabel,
        'denied',
      );
    });
  });

  describe('initialLabel', () => {
    it('takes each label as the element’s, its step saying so', () => {
      for (const label of [
        'satisficed',
        'weakly-satisficed',
        'undecided',
        'weakly-denied',
        'denied',
        'conflict',
      ] as const) {
        const text = withProperties(USABILITY, { initialLabel: label });
        assert.deepStrictEqual(stepOf(text, USABILITY), {
          id: USABILITY,
          label,
          why: 'its initial label',
        });
      }
    });

    it('trims the written label before taking it', () => {
      for (const initialLabel of [' denied', 'denied ', '\n denied \t'])
        assert.deepStrictEqual(
          stepOf(withProperties(RSA_260, { initialLabel }), RSA_260),
          {
            id: RSA_260,
            label: 'denied',
            why: 'its initial label',
          },
        );
    });

    it('applies to softgoals, operationalizations and claims', () => {
      assert.strictEqual(
        labelOf(withProperties(SECURITY, { initialLabel: 'denied' }), SECURITY),
        'denied',
      );
      assert.strictEqual(
        labelOf(withProperties(RSA_260, { initialLabel: 'denied' }), RSA_260),
        'denied',
      );
      assert.strictEqual(
        labelOf(withProperties(CLAIM, { initialLabel: 'denied' }), CLAIM),
        'denied',
      );
    });

    it('unset, empty or blank, propagates', () => {
      const unset: Record<string, string>[] = [
        {},
        { initialLabel: '' },
        { initialLabel: '   ' },
      ];
      for (const properties of unset) {
        const text = withProperties(RSA_260, properties);
        assert.deepStrictEqual(stepOf(text, RSA_260), {
          id: RSA_260,
          label: 'satisficed',
          why: 'chosen: nothing contributes to it',
        });
        assert.deepStrictEqual(
          stepOf(withProperties(USABILITY, properties), USABILITY),
          {
            id: USABILITY,
            label: 'weakly-satisficed',
            why: 'some+ from Authentication (W+): W+',
          },
        );
      }
    });

    it('a value that is no label propagates, as unset', () => {
      // #187: invalid value
      for (const initialLabel of [
        'Denied',
        'DENIED',
        'weakly denied',
        'propagated (default)',
        '✗',
        'bogus',
      ]) {
        assert.deepStrictEqual(
          stepOf(withProperties(RSA_260, { initialLabel }), RSA_260),
          {
            id: RSA_260,
            label: 'satisficed',
            why: 'chosen: nothing contributes to it',
          },
          initialLabel,
        );
        assert.strictEqual(
          labelOf(withProperties(USABILITY, { initialLabel }), USABILITY),
          'weakly-satisficed',
          initialLabel,
        );
      }
    });

    it('a key in another casing is not read', () => {
      assert.strictEqual(
        labelOf(
          withProperties(USABILITY, { InitialLabel: 'denied' }),
          USABILITY,
        ),
        'weakly-satisficed',
      );
    });
  });

  describe('a contribution’s label (a link label, not a property)', () => {
    const throughCorrelation = (label: string) =>
      stepOf(
        edit((json) => {
          json.links.find((link) => link.id.startsWith(CORRELATION))!.label =
            label;
          json.orphans.find((e) => e.id === AUTHENTICATION)!.customProperties =
            { initialLabel: 'satisficed' };
        }),
        USABILITY,
      );

    it('reads each of DSM3’s labels as its contribution', () => {
      assert.deepStrictEqual(
        ['++', '+', 'some+', 'unknown', 'some-', '–', '– –'].map((label) => {
          const step = throughCorrelation(label)!;
          return [label, step.label, step.why];
        }),
        [
          ['++', 'satisficed', '++ from Authentication (✓): ✓'],
          ['+', 'weakly-satisficed', '+ from Authentication (✓): W+'],
          ['some+', 'weakly-satisficed', 'some+ from Authentication (✓): W+'],
          ['unknown', 'undecided', 'unknown from Authentication (✓): U'],
          ['some-', 'weakly-denied', 'some- from Authentication (✓): W−'],
          ['–', 'weakly-denied', '– from Authentication (✓): W−'],
          ['– –', 'denied', '– – from Authentication (✓): ✗'],
        ],
      );
    });

    it('reads any other label, an ASCII hyphen or a padded one, as unknown', () => {
      for (const label of ['-', '--', '– – ', ' +', 'make', 'Some+'])
        assert.deepStrictEqual(
          throughCorrelation(label),
          {
            id: USABILITY,
            label: 'undecided',
            why: `${label} from Authentication (✓): U`,
          },
          label,
        );
    });
  });
});
