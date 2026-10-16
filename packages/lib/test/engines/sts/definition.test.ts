/**
 * The `sts` dialect (goal-controller#163 item 2): its kinds, link kinds and
 * their properties (#160 D-R4, D-R5), its views, the authorisation's
 * checks, and the rules `stsProblems` says of a model (D-R6), one each.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
  propertyKeys,
  type LinkRulesDefinition,
} from '@goal-controller/dialect';
import type { AnalysisModel } from '../../../src/engines/analysis';
import {
  STS_LINKS,
  sts,
  stsCheckRegistry,
  stsExtension,
  stsProblems,
} from '../../../src/engines/sts';
import { stsEngine } from '../../../src/engines/sts/engine';

describe('STS-ml: the definition', () => {
  it('adds information and events, outside actors, and STS-ml’s relationships (#160 D-R4)', () => {
    assert.deepStrictEqual(
      stsExtension.elements.map((e) => [e.kind, e.category]),
      [
        ['sts.Information', 'node'],
        ['sts.Event', 'node'],
      ],
    );
    assert.deepStrictEqual(
      stsExtension.links.map((l) => l.kind),
      Object.values(STS_LINKS),
    );
    const rules: Record<string, LinkRulesDefinition> = Object.fromEntries(
      stsExtension.links.map((l) => [l.kind, l.rules]),
    );
    assert.strictEqual(rules['sts.DelegatesLink']!.sameActor, false);
    assert.strictEqual(
      rules['sts.ReadsLink']!.sameActor,
      undefined,
      'within one actor',
    );
    assert.deepStrictEqual(rules['sts.AuthorisesLink']!.sources, [
      'istar.Role',
      'istar.Agent',
    ]);
  });

  it('keys a delegation’s and a transmission’s needs one each, an authorisation’s four dimensions (#160 D-R5)', () => {
    const keys = Object.fromEntries(
      Object.entries(sts.links!).map(([kind, list]) => [
        kind,
        list.map((p) => p.key),
      ]),
    );
    assert.deepStrictEqual(keys['sts.DelegatesLink'], [
      'noRedelegation',
      'nonRepudiation',
      'redundancy',
      'trustworthiness',
      'availability',
      'authentication',
      'threatenedBy',
    ]);
    assert.deepStrictEqual(keys['sts.TransmitsLink'], [
      'integrity',
      'confidentiality',
      'availability',
      'authentication',
      'nonRepudiation',
      'threatenedBy',
    ]);
    assert.deepStrictEqual(keys['sts.AuthorisesLink'], [
      'granted',
      'prohibited',
      'information',
      'scope',
      'transferable',
    ]);
    const granted = sts.links!['sts.AuthorisesLink']![0]!;
    assert.strictEqual(granted.value.type, 'enumSet');
    assert.deepStrictEqual(propertyKeys(sts, 'goal'), ['description']);
  });

  it('declares the three views of one model', () => {
    assert.deepStrictEqual(
      Object.entries(sts.views!).map(([id, view]) => [id, view.label]),
      [
        ['social', 'Social'],
        ['information', 'Information'],
        ['authorisation', 'Authorisation'],
      ],
    );
  });

  it('is an analysis engine whose models declare its kinds', () => {
    assert.strictEqual(stsEngine.id, 'sts');
    assert.strictEqual(stsEngine.fileKinds, true);
    assert.ok(stsEngine.analyses?.stsDialect);
  });
});

describe('STS-ml: the authorisation’s checks', () => {
  const link = (target: string) => ({
    self: 'a1',
    kindOf: () => undefined,
    readLink: () => ({
      kind: 'sts.AuthorisesLink',
      ends: {
        source: { iStarId: 'citizen', kind: 'istar.Role' },
        target: { iStarId: target, kind: 'istar.Role' },
      },
      properties: {},
    }),
    readActor: (id: string) =>
      id === 'agency'
        ? {
            kind: 'istar.Role',
            name: 'Agency',
            properties: {},
            elements: ['G4', 'G5'],
          }
        : undefined,
  });
  const check = stsCheckRegistry;

  it('an operation granted and prohibited', () => {
    assert.match(
      check['sts.authorisation.operations'](
        { granted: 'read, produce', prohibited: 'produce', information: 'I1' },
        link('agency') as never,
      )!,
      /produce is both granted and prohibited/,
    );
  });
  it('no information, or nothing granted or prohibited (DKE Def. 3(6))', () => {
    assert.match(
      check['sts.authorisation.information'](
        { granted: 'read', information: '' },
        link('agency') as never,
      )!,
      /at least one information/,
    );
    assert.match(
      check['sts.authorisation.information'](
        { information: 'I1' },
        link('agency') as never,
      )!,
      /grants or prohibits/,
    );
    assert.strictEqual(
      check['sts.authorisation.information'](
        { prohibited: 'transmit', information: 'I1' },
        link('agency') as never,
      ),
      null,
    );
  });
  it('a scope goal that isn’t the authorisee’s, and nothing without the model', () => {
    assert.match(
      check['sts.authorisation.scope'](
        { scope: 'G4, G1' },
        link('agency') as never,
      )!,
      /G1 is not the authorisee’s/,
    );
    assert.strictEqual(
      check['sts.authorisation.scope'](
        { scope: 'G4, G5' },
        link('agency') as never,
      ),
      null,
    );
    assert.strictEqual(
      check['sts.authorisation.scope'](
        { scope: 'G1' },
        { self: 'a1', kindOf: () => undefined },
      ),
      null,
    );
  });
});

describe('STS-ml: the dialect’s problems (#160 D-R6)', () => {
  /** two actors, A (G1 decomposed into G2, G3; R1) and B (G4, a copy of G3; R2) */
  const model = (
    links: AnalysisModel['links'],
    elements: Partial<Record<string, string>> = {},
  ): AnalysisModel => ({
    actors: [
      {
        id: 'A',
        kind: 'istar.Role',
        name: 'A',
        properties: {},
        elements: ['g1', 'g2', 'g3', 'r1'],
      },
      {
        id: 'B',
        kind: 'istar.Role',
        name: 'B',
        properties: {},
        elements: ['g4', 'r2'],
      },
    ],
    elements: [
      {
        id: 'g1',
        kind: 'istar.Goal',
        name: 'G1: root',
        properties: {},
        actor: 'A',
      },
      {
        id: 'g2',
        kind: 'istar.Goal',
        name: 'G2: left',
        properties: {},
        actor: 'A',
      },
      {
        id: 'g3',
        kind: 'istar.Goal',
        name: 'G3: right',
        properties: {},
        actor: 'A',
      },
      {
        id: 'g4',
        kind: 'istar.Goal',
        name: elements.g4 ?? 'G4: right',
        properties: {},
        actor: 'B',
      },
      {
        id: 'r1',
        kind: 'istar.Resource',
        name: 'R1: doc',
        properties: {},
        actor: 'A',
      },
      {
        id: 'r2',
        kind: 'istar.Resource',
        name: 'R2: doc',
        properties: {},
        actor: 'B',
      },
      { id: 'i1', kind: 'sts.Information', name: 'I1: data', properties: {} },
    ],
    links: [
      {
        id: 'and2',
        kind: 'istar.AndRefinementLink',
        source: 'g2',
        target: 'g1',
        properties: {},
      },
      {
        id: 'and3',
        kind: 'istar.AndRefinementLink',
        source: 'g3',
        target: 'g1',
        properties: {},
      },
      ...links,
    ],
  });
  const kinds = (m: AnalysisModel) => stsProblems(m).map((f) => f.kind);
  const link = (
    id: string,
    kind: string,
    source: string,
    target: string,
    properties: Record<string, string> = {},
  ) => ({ id, kind, source, target, properties });

  it('a well-formed delegation, transmission and authorisation: nothing', () => {
    assert.deepStrictEqual(
      kinds(
        model([
          link('d', 'sts.DelegatesLink', 'g3', 'g4'),
          link('t', 'sts.TransmitsLink', 'r1', 'r2'),
          link('a', 'sts.AuthorisesLink', 'A', 'B', {
            granted: 'read',
            information: 'I1',
            scope: 'G4',
          }),
        ]),
      ),
      [],
    );
  });
  it('goalSingleDecomposition', () => {
    const m = model([link('and4', 'istar.AndRefinementLink', 'g4', 'g4x')]);
    assert.ok(
      kinds({
        ...m,
        elements: [
          ...m.elements,
          {
            id: 'g4x',
            kind: 'istar.Goal',
            name: 'G5: x',
            properties: {},
            actor: 'B',
          },
        ],
      }).includes('goalSingleDecomposition'),
    );
  });
  it('delegatedGoalNotLeaf: a decomposed goal delegated', () => {
    assert.deepStrictEqual(
      kinds(model([link('d', 'sts.DelegatesLink', 'g1', 'g4')])),
      ['copyNameDiffers', 'delegatedGoalNotLeaf'],
    );
  });
  it('copyInSameActor and copyNameDiffers', () => {
    assert.deepStrictEqual(
      kinds(model([link('d', 'sts.DelegatesLink', 'g3', 'g2')])),
      ['copyInSameActor', 'copyNameDiffers'],
    );
    assert.deepStrictEqual(
      kinds(
        model([link('d', 'sts.DelegatesLink', 'g3', 'g4')], {
          g4: 'G4: other',
        }),
      ),
      ['copyNameDiffers'],
    );
  });
  it('linkEnds: a kind its rules don’t join, or a goal–document link across actors', () => {
    assert.deepStrictEqual(
      kinds(model([link('o', 'sts.OwnsLink', 'g1', 'i1')])),
      ['linkEnds'],
    );
    assert.deepStrictEqual(
      kinds(model([link('r', 'sts.ReadsLink', 'g1', 'r2')])),
      ['linkEnds'],
    );
  });
  it('partOfMixed and dutyMixed', () => {
    assert.deepStrictEqual(
      kinds(model([link('p', 'sts.PartOfLink', 'i1', 'r1')])),
      ['partOfMixed'],
    );
    assert.deepStrictEqual(
      kinds(model([link('s', 'sts.IncompatibleLink', 'g1', 'A')])),
      ['dutyMixed'],
    );
  });
  it('the authorisation’s: invalid, overlapping, a scope outside the authorisee', () => {
    assert.deepStrictEqual(
      kinds(
        model([
          link('a1', 'sts.AuthorisesLink', 'A', 'B', { information: 'I1' }),
          link('a2', 'sts.AuthorisesLink', 'A', 'B', {
            granted: 'read',
            prohibited: 'read',
            information: 'I1',
          }),
          link('a3', 'sts.AuthorisesLink', 'A', 'B', {
            granted: 'read',
            information: 'I1',
            scope: 'G1',
          }),
        ]),
      ),
      [
        'authorisationInvalid',
        'authorisationOperationsOverlap',
        'authorisationScopeNotAuthorisee',
      ],
    );
  });
});
