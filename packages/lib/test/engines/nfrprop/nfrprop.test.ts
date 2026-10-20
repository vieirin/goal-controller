/**
 * nfrprop (goal-controller#171): the NFR Framework's label propagation
 * (Chung et al. 2000, ch. 3). The oracle is DSM3's NFR example labelled by
 * hand with Chung et al.'s rules, committed next to the seed
 * (examples/nfr/nfr-welcome.labels.csv, each label's derivation beside it).
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { describe, it } from 'mocha';
import { analysisText } from '../../../src/engines/analysis';
import {
  combined,
  impact,
  nfrprop,
  nfrpropAnalyses,
  nfrpropAnalysisModel,
  nfrpropProjectResourceParsers,
  propagateLabels,
  readNfrModel,
  readNfrStrategies,
  refined,
  type NfrContribution,
  type NfrLabel,
} from '../../../src/engines/nfrprop';
import { nfrpropEngine } from '../../../src/engines/nfrprop/engine';

const SEED = readFileSync('../../examples/nfr/nfr-welcome.txt', 'utf8');
const ORACLE = readFileSync(
  '../../examples/nfr/nfr-welcome.labels.csv',
  'utf8',
);
const RSA_260_ONLY = readFileSync(
  '../../examples/nfr/strategies/rsa-260-only.json',
  'utf8',
);
const BOTH = readFileSync('../../examples/nfr/strategies/both.json', 'utf8');

/** A CSV's rows (`id,element,label,derivation,strategy`), its quoted fields unquoted. */
const csv = (text: string): string[][] =>
  text
    .trim()
    .split('\n')
    .slice(1)
    .map((line) =>
      [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)]
        .slice(0, -1)
        .map((m) => m[2] ?? m[1]!),
    );

const labelsOf = (text: string) =>
  propagateLabels(nfrpropAnalysisModel(readNfrModel(text))).labels;

/** The seed with some elements' initial labels set, by name. */
const withInitial = (labels: Record<string, NfrLabel>): string => {
  const json = JSON.parse(SEED);
  for (const element of json.orphans)
    if (labels[element.text])
      element.customProperties = {
        ...element.customProperties,
        initialLabel: labels[element.text],
      };
  return JSON.stringify(json);
};
const byName = (text: string) => {
  const names = new Map(
    JSON.parse(text).orphans.map((e: { id: string; text: string }) => [
      e.id,
      e.text,
    ]),
  );
  return Object.fromEntries(
    [...labelsOf(text)].map(([id, label]) => [names.get(id), label]),
  );
};

describe('nfrprop: the NFR Framework’s label propagation', () => {
  it('labels DSM3’s example as Chung et al.’s rules do by hand', () => {
    const labels = labelsOf(SEED);
    const expected = csv(ORACLE).filter(([, , , , strategy]) => !strategy);
    assert.strictEqual(expected.length, 9);
    for (const [id, name, label] of expected)
      assert.strictEqual(labels.get(id!), label, name);
    assert.strictEqual(labels.size, expected.length);
  });

  it('applies Chung et al.’s individual impacts, weak labels propagating weakly', () => {
    const contributions: NfrContribution[] = [
      'break',
      'some-',
      'hurt',
      'unknown',
      'help',
      'some+',
      'make',
    ];
    const table: Record<NfrLabel, NfrLabel[]> = {
      denied: [
        'weakly-satisficed',
        'weakly-satisficed',
        'weakly-satisficed',
        'undecided',
        'weakly-denied',
        'weakly-denied',
        'denied',
      ],
      conflict: [
        'conflict',
        'conflict',
        'conflict',
        'undecided',
        'conflict',
        'conflict',
        'conflict',
      ],
      undecided: Array(7).fill('undecided'),
      satisficed: [
        'denied',
        'weakly-denied',
        'weakly-denied',
        'undecided',
        'weakly-satisficed',
        'weakly-satisficed',
        'satisficed',
      ],
      'weakly-satisficed': [
        'weakly-denied',
        'weakly-denied',
        'weakly-denied',
        'undecided',
        'weakly-satisficed',
        'weakly-satisficed',
        'weakly-satisficed',
      ],
      'weakly-denied': [
        'weakly-satisficed',
        'weakly-satisficed',
        'weakly-satisficed',
        'undecided',
        'weakly-denied',
        'weakly-denied',
        'weakly-denied',
      ],
    };
    for (const [offspring, row] of Object.entries(table))
      assert.deepStrictEqual(
        contributions.map((c) => impact(offspring as NfrLabel, c)),
        row,
        offspring,
      );
  });

  it('takes the least offspring for AND, the greatest for OR, and resolves impacts', () => {
    assert.strictEqual(
      refined('and', ['satisficed', 'weakly-denied']),
      'weakly-denied',
    );
    assert.strictEqual(
      refined('or', ['denied', 'conflict', 'undecided']),
      'undecided',
    );
    assert.strictEqual(combined([]), 'undecided');
    assert.strictEqual(
      combined(['undecided', 'weakly-satisficed']),
      'weakly-satisficed',
    );
    assert.strictEqual(
      combined(['weakly-satisficed', 'satisficed']),
      'satisficed',
    );
    assert.strictEqual(
      combined(['weakly-denied', 'weakly-denied']),
      'weakly-denied',
    );
    assert.strictEqual(combined(['satisficed', 'weakly-denied']), 'conflict');
    assert.strictEqual(combined(['conflict', 'satisficed']), 'conflict');
  });

  it('starts from the initial labels a developer gives', () => {
    // RSA 260 rejected: its HELP weakly denies, as RSA 128's HURT does
    assert.deepStrictEqual(
      byName(withInitial({ 'Encrypt with RSA 260 bits': 'denied' })),
      {
        ...byName(SEED),
        'Encrypt with RSA 260 bits': 'denied',
        Confidenciality: 'weakly-denied',
        Security: 'weakly-denied',
      },
    );
  });

  it('sets a contribution aside when a claim on it is denied, and decides nothing while one is undecided', () => {
    const denied = byName(withInitial({ 'Can be broken quickly': 'denied' }));
    assert.strictEqual(denied.Confidenciality, 'weakly-satisficed');
    assert.strictEqual(denied.Security, 'weakly-satisficed');
    const open = byName(withInitial({ 'Can be broken quickly': 'undecided' }));
    assert.strictEqual(open.Confidenciality, 'weakly-satisficed');
  });

  it('ends a cycle undecided where it closes', () => {
    const json = JSON.parse(SEED);
    json.links.push({
      id: 'back',
      type: 'nfr.ContributionLink',
      source: 'b79575b1-2b32-466b-bd0f-2f2f41cbcf41',
      target: 'cdfac142-9e92-403f-a3c9-b1858a5e6e77',
      label: '++',
    });
    assert.strictEqual(byName(JSON.stringify(json)).Security, 'conflict');
  });

  it('reports the propagation step by step, the labels drawn on the model', () => {
    const result = nfrpropAnalyses.nfrLabels.run(
      nfrpropAnalysisModel(readNfrModel(SEED)),
    );
    const [labels] = result.cases;
    assert.strictEqual(labels!.steps!.length, 9);
    const names = new Map(
      JSON.parse(SEED).orphans.map((e: { id: string; text: string }) => [
        e.id,
        e.text,
      ]),
    );
    assert.strictEqual(
      analysisText(result, (id) => (names.get(id) as string) ?? id)
        .split('\n')
        .filter((line) => line.startsWith('  step'))
        .join('\n'),
      [
        '  step 1: Encrypt with RSA 260 bits: ✓ satisficed (chosen: nothing contributes to it)',
        '  step 2: Can be broken quickly: ✓ satisficed (chosen: nothing contributes to it)',
        '  step 3: Encrypt with RSA 128 bits: ✓ satisficed (chosen: nothing contributes to it)',
        '  step 4: Confidenciality: ⚡ conflict (+ from Encrypt with RSA 260 bits (✓): W+; – from Encrypt with RSA 128 bits (✓): W−, argued by Can be broken quickly)',
        '  step 5: Login with Username and Password: ✓ satisficed (chosen: nothing contributes to it)',
        '  step 6: Authentication: W+ weakly-satisficed (+ from Login with Username and Password (✓): W+)',
        '  step 7: Security: ⚡ conflict (AND of Confidenciality (⚡), Authentication (W+): ⚡)',
        '  step 8: Usability: W+ weakly-satisficed (some+ from Authentication (W+): W+)',
        '  step 9: Example of a big, colored NFR: U undecided (nothing contributes to it)',
      ].join('\n'),
    );
    assert.deepStrictEqual(
      labels!.values['cdfac142-9e92-403f-a3c9-b1858a5e6e77'],
      {
        value: 'conflict',
        label: '⚡ conflict',
        severity: 'warning',
      },
    );
  });

  it('is an analysis engine: its labels on the model, no file', () => {
    assert.strictEqual(nfrpropEngine.id, 'nfrprop');
    assert.deepStrictEqual(Object.keys(nfrpropEngine.analyses!), ['nfrLabels']);
    assert.ok(!('outputs' in nfrpropEngine));
    assert.strictEqual(nfrprop.projectResources.strategies.many, true);
  });
});

describe('nfrprop strategies (the strategies resource, goal-controller#328)', () => {
  const file = (text: object, path = 'strategies/a.json') => ({
    path,
    text: JSON.stringify(text),
  });

  it('resolves a strategy’s labels by name or by piStar id', () => {
    const { strategies, diagnostics } = readNfrStrategies([
      file({
        name: 'A',
        labels: { 'Can be broken quickly': 'denied', x: 'conflict' },
      }),
    ]);
    assert.deepStrictEqual(diagnostics, []);
    assert.deepStrictEqual(strategies.length, 1);
    assert.deepStrictEqual(
      [...strategies[0]!.labels],
      [
        ['Can be broken quickly', 'denied'],
        ['x', 'conflict'],
      ],
    );
  });

  it('says what is wrong: no `labels`, an unknown label', () => {
    const { diagnostics } = readNfrStrategies([
      file({ name: 'A' }),
      file(
        { name: 'B', labels: { a: 'satisficed', b: 'fine' } },
        'strategies/b.json',
      ),
    ]);
    assert.deepStrictEqual(
      diagnostics.map((d) => d.message),
      [
        'A strategy file has a `labels` object',
        "Strategy B: element b's label is one of satisficed, weakly-satisficed, undecided, weakly-denied, denied, conflict",
      ],
    );
  });

  it('gives one case per strategy, "Model labels" first, by file order', () => {
    const resource = {
      'strategies/rsa-260-only.json': RSA_260_ONLY,
      'strategies/both.json': BOTH,
    };
    const result = nfrpropAnalyses.nfrLabels.run(
      nfrpropAnalysisModel(readNfrModel(SEED)),
      resource,
    );
    assert.deepStrictEqual(
      result.cases.map((c) => c.label),
      ['Model labels', 'RSA 260 only', 'both'],
    );
    const names = new Map(
      JSON.parse(SEED).orphans.map((e: { id: string; text: string }) => [
        e.id,
        e.text,
      ]),
    );
    const byName = (values: (typeof result.cases)[number]['values']) =>
      Object.fromEntries(
        Object.entries(values).map(([id, v]) => [
          names.get(id) as string,
          v.value,
        ]),
      );
    const expectedStrategy = csv(ORACLE).filter(
      ([, , , , strategy]) => strategy === 'RSA 260 only',
    );
    assert.strictEqual(expectedStrategy.length, 9);
    const strategyCase = byName(result.cases[1]!.values);
    for (const [, name, label] of expectedStrategy)
      assert.strictEqual(strategyCase[name!], label, name);
    // "both": no overrides, the same labels as the model's own
    assert.deepStrictEqual(
      byName(result.cases[2]!.values),
      byName(result.cases[0]!.values),
    );
  });

  it('says what a strategy sets the model doesn’t have, in its case label', () => {
    const resource = {
      'strategies/ghost.json': JSON.stringify({
        name: 'Ghost',
        labels: { ghost: 'satisficed' },
      }),
    };
    const result = nfrpropAnalyses.nfrLabels.run(
      nfrpropAnalysisModel(readNfrModel(SEED)),
      resource,
    );
    assert.strictEqual(
      result.cases[1]!.label,
      "Ghost (sets ghost, which the model doesn't have)",
    );
  });

  it('is a project resource, parsed, that `defineEngine` checks is paired', () => {
    assert.strictEqual(
      nfrpropProjectResourceParsers.strategies,
      nfrpropEngine.projectResources!.strategies,
    );
  });
});
