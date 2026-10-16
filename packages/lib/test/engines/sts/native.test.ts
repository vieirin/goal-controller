/**
 * STS-Tool's `.sts` as the `sts` dialect's native file (goal-controller
 * #163 item 4): the hand-written fixture, read into the model #160 D-R4
 * and D-R5 describe, written and read back; and a model written, read
 * back, itself but for `lossy`. Unverified against STS-Tool (#160 D-R2);
 * the tutorial projects are the stress script's (D-R8).
 */
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it } from 'mocha';
import { readXmi } from '@goal-controller/goal-language/formats';
import {
  pistarAnalysisModel,
  readSts,
  sts,
  stsProblems,
  writeSts,
} from '../../../src';
import { modelRoundTrip } from '../../../src/importers/native';
import { describeNativeRoundTrips } from '../../support/nativeRoundTrip';

type Json = Record<string, any>;
const fixture = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'tax-toy.sts'),
  'utf8',
);
const file = sts.nativeFiles!.sts!;
const read = () => {
  const result = readSts(fixture, { modelName: 'tax-toy' });
  return { ...result, model: result.model as Json };
};
const nodeById = (model: Json, id: string): Json =>
  [...model.actors.flatMap((a: Json) => a.nodes), ...model.orphans].find(
    (n: Json) => n.id === id,
  );
const linkById = (model: Json, id: string): Json =>
  model.links.find((l: Json) => l.id === id);

describeNativeRoundTrips(sts, [
  { name: 'tax-toy.sts', file: 'sts', text: fixture },
]);

describe('STS-ml: .sts read (the hand-written fixture)', () => {
  it('reads roles and agents, each with its goals and documents', () => {
    const { model, diagnostics } = read();
    assert.deepStrictEqual(
      model.actors.map((a: Json) => [
        a.text,
        a.type,
        a.nodes.map((n: Json) => n.text),
      ]),
      [
        [
          'Citizen',
          'istar.Role',
          [
            'G1: taxes paid',
            'G2: form filled',
            'G3: payment made',
            'R1: tax form',
            'R2: id card',
          ],
        ],
        [
          'Agency',
          'istar.Role',
          [
            'G4: payment made',
            'G5: paid online',
            'G6: paid at desk',
            'R3: id card',
          ],
        ],
        ['Ann', 'istar.Agent', []],
      ],
    );
    assert.deepStrictEqual(
      model.orphans.map((n: Json) => [n.text, n.type]),
      [
        ['E1: card lost', 'sts.Event'],
        ['I1: personal data', 'sts.Information'],
        ['I2: name', 'sts.Information'],
      ],
    );
    assert.deepStrictEqual(
      diagnostics.map((d) => d.severity),
      ['info'],
      'the note, left out',
    );
    assert.strictEqual(
      model.actors[0].customProperties.description,
      'pays taxes',
    );
    assert.deepStrictEqual(model.diagram.customProperties, {
      engine: 'sts',
      author: 'goal-controller',
      revision: '1',
      version: '1',
      company: 'none',
    });
  });

  it('places an actor’s goals relative to it, and lays out the information', () => {
    const { model } = read();
    assert.deepStrictEqual(
      [
        model.actors[1].x,
        model.actors[1].y,
        nodeById(model, 'g-online').x,
        nodeById(model, 'g-online').y,
      ],
      [700, 40, 800, 160],
    );
    assert.ok(Number.isFinite(nodeById(model, 'i-personal').x));
  });

  it('reads a decomposition as iStar’s refinement, child to parent', () => {
    const { model } = read();
    assert.deepStrictEqual(
      ['dec-form', 'dec-online'].map((id) => {
        const { type, source, target } = linkById(model, id);
        return [type, source, target];
      }),
      [
        ['istar.AndRefinementLink', 'g-form', 'g-paid'],
        ['istar.OrRefinementLink', 'g-online', 'g-payment-agency'],
      ],
    );
  });

  it('reads a delegation to the delegatee’s copy, its needs as properties (#160 D-R5)', () => {
    const { model } = read();
    assert.deepStrictEqual(linkById(model, 'delegate-payment'), {
      id: 'delegate-payment',
      type: 'sts.DelegatesLink',
      source: 'g-payment',
      target: 'g-payment-agency',
      customProperties: {
        noRedelegation: 'true',
        availability: '90',
        nonRepudiation: 'delegationAcceptance',
        redundancy: 'trueMultiActor',
        authentication: 'delegatee',
        trustworthiness: 'true',
      },
    });
    assert.deepStrictEqual(linkById(model, 'send-card').customProperties, {
      integrity: 'sender',
      confidentiality: 'receiver',
      availability: '70',
      authentication: 'receiver',
    });
  });

  it('reads an authorisation’s operations as granted and prohibited, its information and scope by text id', () => {
    const { model } = read();
    assert.deepStrictEqual(linkById(model, 'authorise-agency'), {
      id: 'authorise-agency',
      type: 'sts.AuthorisesLink',
      source: 'citizen',
      target: 'agency',
      customProperties: {
        granted: 'read',
        prohibited: 'produce, transmit',
        information: 'I1',
        scope: 'G4',
        transferable: 'false',
      },
    });
  });

  it('reads the information view, threats, plays and duties', () => {
    const { model } = read();
    assert.deepStrictEqual(
      [
        'name-part',
        'own-personal',
        'personal-on-card',
        'lost-card',
        'ann-plays-agency',
        'sod-form-payment',
        'cod-roles',
        'read-card',
        'modify-card',
        'produce-form',
      ].map((id) => {
        const { type, source, target } = linkById(model, id);
        return `${type} ${source} → ${target}`;
      }),
      [
        'sts.PartOfLink i-name → i-personal',
        'sts.OwnsLink citizen → i-personal',
        'sts.TangibleByLink i-personal → d-card',
        'sts.ThreatensLink e-lost → d-card',
        'istar.ParticipatesInLink ann → agency',
        'sts.IncompatibleLink g-form → g-payment',
        'sts.CombinesLink citizen → agency',
        'sts.ReadsLink g-form → d-card',
        'sts.ModifiesLink g-payment-agency → d-card-agency',
        'sts.ProducesLink g-form → d-form',
      ],
    );
  });

  it('gives the dialect’s checks nothing to say of it', () => {
    assert.deepStrictEqual(stsProblems(pistarAnalysisModel(read().model)), []);
  });

  it('is not an STS-Tool model when its root isn’t STSDiagram', () => {
    const result = readSts('<?xml version="1.0"?><other/>');
    assert.strictEqual(result.model, null);
    assert.strictEqual(result.diagnostics.at(-1)!.severity, 'error');
  });
});

describe('STS-ml: .sts written (unverified against STS-Tool)', () => {
  it('written and read back, the fixture’s model is itself but for the lossy paths', () => {
    const trip = modelRoundTrip(file, read().model, { modelName: 'tax-toy' });
    assert.strictEqual(trip.problem, null);
  });

  it('writes both ends of each reference, by path, as STS-Tool does', () => {
    const { text, diagnostics } = writeSts(read().model);
    assert.deepStrictEqual(diagnostics, []);
    const { reader } = readXmi(text!, { idAttribute: 'id' });
    const byId = reader!.document.byId;
    const delegation = byId.get('delegate-payment')!;
    assert.strictEqual(delegation.type, 'ststool:Delegation');
    assert.match(delegation.attributes.sourceGoal!, /^\/\/@elements\.\d+$/);
    const copy = byId.get('g-payment-agency')!;
    assert.strictEqual(copy.type, 'ststool:GoalReference');
    assert.deepStrictEqual(
      reader!.references(copy, 'reference').map((n) => n.id),
      ['g-payment'],
    );
    assert.deepStrictEqual(
      reader!
        .references(byId.get('g-payment')!, 'delegatedTo')
        .map((n) => n.id),
      ['delegate-payment'],
    );
    assert.deepStrictEqual(
      reader!
        .references(byId.get('citizen')!, 'outgoingDelegations')
        .map((n) => n.id),
      ['delegate-payment-in'],
    );
    const authorisation = byId.get('authorise-agency')!;
    assert.deepStrictEqual(
      [
        authorisation.attributes.read,
        authorisation.attributes.modification,
        authorisation.attributes.produce,
        authorisation.attributes.transmit,
      ],
      ['AUTHORIZED', undefined, 'FORBIDDEN', 'FORBIDDEN'],
    );
  });

  it('writes the same model to the same text', () => {
    const { model } = read();
    assert.strictEqual(writeSts(model).text, writeSts(model).text);
  });

  it('says what it can’t write', () => {
    const { model } = read();
    model.links.push({
      id: 'c',
      type: 'istar.ContributionLink',
      source: 'g-form',
      target: 'g-payment',
      label: 'help',
    });
    assert.deepStrictEqual(
      writeSts(model).diagnostics.map((d) => d.message),
      [
        "istar.ContributionLink c: STS-Tool's file has no such relationship; not written",
      ],
    );
  });
});
