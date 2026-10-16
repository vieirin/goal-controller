/**
 * STS-ml's analyses (goal-controller#161 item 5): for each finding kind, a
 * minimal model that triggers it and one that doesn't, by #160 item 1's
 * definitions and D items.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import {
  runStsAnalyses,
  stsSecurityAnalyses,
  type StsAnalysisId,
} from '../../../../src/engines/sts/analysis';
import type { AnalysisModel } from '../../../../src/engines/analysis';
import { stsModel } from './support';

const findingsOf = (model: AnalysisModel, id: StsAnalysisId, kind: string) =>
  runStsAnalyses(model).findings[id].filter((f) => f.kind === kind);
const has = (model: AnalysisModel, id: StsAnalysisId, kind: string) =>
  findingsOf(model, id, kind).length > 0;

/** A delegator A and a delegatee B, A's goal G delegated. */
const delegation = (properties: Record<string, string> = {}) => {
  const m = stsModel();
  m.role('A');
  m.role('B');
  m.goal('A', 'G');
  const d = m.delegate('G', 'B', properties);
  return { m, ...d };
};

describe('STS-ml well-formedness analysis (#160 item 1 §1)', () => {
  it('delegationChildCycle: a subgoal of the delegatum delegated back (NESSoS Fig. 17)', () => {
    const { m, copy } = delegation();
    m.goal('B', 'G1');
    m.goal('B', 'G2');
    m.and(copy, ['G1', 'G2']);
    m.delegate('G1', 'A');
    const [f] = findingsOf(m.model(), 'wellFormedness', 'delegationChildCycle');
    assert.strictEqual(f?.severity, 'warning');
    assert.strictEqual(f?.details?.goal, 'G1');
    const ok = delegation();
    ok.m.goal('B', 'G1');
    ok.m.goal('B', 'G2');
    ok.m.and(ok.copy, ['G1', 'G2']);
    ok.m.role('C');
    ok.m.delegate('G1', 'C');
    assert.ok(!has(ok.m.model(), 'wellFormedness', 'delegationChildCycle'));
  });

  it('documentPartOfCycle and informationPartOfCycle: one warning per cycle (DKE Def. 3(8b))', () => {
    const m = stsModel();
    m.role('A');
    m.document('A', 'D1');
    m.document('A', 'D2');
    m.partOf('D1', 'D2');
    m.information('I1');
    m.information('I2');
    m.owns('A', 'I1');
    m.owns('A', 'I2');
    m.partOf('I1', 'I2');
    assert.ok(!has(m.model(), 'wellFormedness', 'documentPartOfCycle'));
    assert.ok(!has(m.model(), 'wellFormedness', 'informationPartOfCycle'));
    m.partOf('D2', 'D1');
    m.partOf('I2', 'I1');
    const [d] = findingsOf(m.model(), 'wellFormedness', 'documentPartOfCycle');
    assert.deepStrictEqual(d?.elements, ['D1', 'D2']);
    assert.strictEqual(
      findingsOf(m.model(), 'wellFormedness', 'informationPartOfCycle').length,
      1,
    );
  });

  it('informationNoOwner: none of its own nor of a whole it is part of (#160 D-G13)', () => {
    const m = stsModel();
    m.role('A');
    m.information('W');
    m.information('P');
    m.partOf('P', 'W');
    assert.deepStrictEqual(
      findingsOf(m.model(), 'wellFormedness', 'informationNoOwner').map(
        (f) => f.details?.information,
      ),
      ['W', 'P'],
    );
    m.owns('A', 'W');
    assert.ok(!has(m.model(), 'wellFormedness', 'informationNoOwner'));
  });

  it('duplicateAuthorisations: identical, or one a subset of the other', () => {
    const m = stsModel();
    m.role('A');
    m.role('B');
    m.information('I');
    m.information('J');
    m.owns('A', 'I');
    m.owns('A', 'J');
    m.authorise('A', 'B', {
      information: ['I', 'J'],
      granted: ['read', 'modify'],
    });
    m.authorise('A', 'B', {
      information: ['I'],
      granted: ['modify'],
      transferable: false,
    });
    assert.ok(!has(m.model(), 'wellFormedness', 'duplicateAuthorisations'));
    m.authorise('A', 'B', { information: ['I'], granted: ['read'] });
    const [f] = findingsOf(
      m.model(),
      'wellFormedness',
      'duplicateAuthorisations',
    );
    assert.strictEqual(f?.details?.equal, 'false');
  });

  it('inconsistentContributionCycle: a cycle mixing + and −', () => {
    const m = stsModel();
    m.role('A');
    m.goal('A', 'G1');
    m.goal('A', 'G2');
    m.contributes('G1', 'G2', 'help');
    m.contributes('G2', 'G1', 'help');
    assert.ok(
      !has(m.model(), 'wellFormedness', 'inconsistentContributionCycle'),
    );
    const n = stsModel();
    n.role('A');
    n.goal('A', 'G1');
    n.goal('A', 'G2');
    n.contributes('G1', 'G2', 'help');
    n.contributes('G2', 'G1', 'hurt');
    assert.ok(
      has(n.model(), 'wellFormedness', 'inconsistentContributionCycle'),
    );
  });

  it('negativeContributionAndSubgoals: − between AND-subgoals of one goal, not OR', () => {
    const build = (or: boolean) => {
      const m = stsModel();
      m.role('A');
      ['G', 'G1', 'G2'].forEach((g) => m.goal('A', g));
      (or ? m.or : m.and)('G', ['G1', 'G2']);
      m.contributes('G1', 'G2', 'hurt');
      return m.model();
    };
    assert.ok(
      has(build(false), 'wellFormedness', 'negativeContributionAndSubgoals'),
    );
    assert.ok(
      !has(build(true), 'wellFormedness', 'negativeContributionAndSubgoals'),
    );
  });

  it('conflictingOrgConstraints: SoD and CoD over the same pair, either way round', () => {
    const m = stsModel();
    m.role('A');
    m.goal('A', 'G1');
    m.goal('A', 'G2');
    m.sod('G1', 'G2');
    assert.ok(!has(m.model(), 'wellFormedness', 'conflictingOrgConstraints'));
    m.cod('G2', 'G1');
    const [f] = findingsOf(
      m.model(),
      'wellFormedness',
      'conflictingOrgConstraints',
    );
    assert.strictEqual(f?.severity, 'error');
  });
});

describe('STS-ml security analysis: authorisations (DKE Def. 5)', () => {
  /** A owns I, a part P; B and C authorise D over I. */
  const towardsD = (
    b: Parameters<ReturnType<typeof stsModel>['authorise']>[2],
    c: Parameters<ReturnType<typeof stsModel>['authorise']>[2],
  ) => {
    const m = stsModel();
    ['A', 'B', 'C', 'D'].forEach((x) => m.role(x));
    m.goal('D', 'G');
    m.goal('D', 'G1');
    m.goal('D', 'G2');
    m.and('G', ['G1', 'G2']);
    m.information('I');
    m.information('P');
    m.partOf('P', 'I');
    m.owns('A', 'I');
    m.authorise('B', 'D', b);
    m.authorise('C', 'D', c);
    return m.model();
  };

  it('authorisationConflict: one grants what the other prohibits, in intersecting scopes, parts included', () => {
    const model = towardsD(
      { information: ['I'], scope: ['G'], granted: ['produce'] },
      { information: ['P'], scope: ['G1'], prohibited: ['produce'] },
    );
    const found = findingsOf(model, 'security', 'authorisationConflict');
    assert.deepStrictEqual(
      found.map((f) => [f.details?.information, f.details?.on]),
      [['P', 'produce']],
    );
    assert.ok(
      !has(
        towardsD(
          { information: ['I'], scope: ['G1'], granted: ['produce'] },
          { information: ['I'], scope: ['G2'], prohibited: ['produce'] },
        ),
        'security',
        'authorisationConflict',
      ),
    );
  });

  it('authorisationConflict: one scoped and the other not (Def. 5(1)), or transferability differing (5(2)(ii))', () => {
    const scoped = towardsD(
      { information: ['I'], scope: ['G'], granted: ['read'] },
      { information: ['I'], granted: ['read'] },
    );
    assert.deepStrictEqual(
      findingsOf(scoped, 'security', 'authorisationConflict').map(
        (f) => f.details?.on,
      ),
      ['scope', 'scope'],
    );
    const transfer = towardsD(
      { information: ['I'], scope: ['G'], granted: ['read'] },
      {
        information: ['I'],
        scope: ['G'],
        granted: ['read'],
        transferable: false,
      },
    );
    assert.deepStrictEqual(
      findingsOf(transfer, 'security', 'authorisationConflict').map(
        (f) => f.details?.on,
      ),
      ['transferability', 'transferability'],
    );
    // a prohibition passes no right to transfer (DKE §3.2.2)
    assert.ok(
      !has(
        towardsD(
          { information: ['I'], scope: ['G'], granted: ['read'] },
          {
            information: ['I'],
            scope: ['G'],
            prohibited: ['modify'],
            transferable: false,
          },
        ),
        'security',
        'authorisationConflict',
      ),
    );
  });
});

describe('STS-ml security analysis: delegations (DKE Table 7, §4.2.2.2)', () => {
  it('noRedelegation: the delegatum or any subgoal of it, redelegated', () => {
    const { m, copy } = delegation({ noRedelegation: 'true' });
    m.role('C');
    m.goal('B', 'G1');
    m.goal('B', 'G11');
    m.goal('B', 'G12');
    m.goal('B', 'G2');
    m.and(copy, ['G1', 'G2']);
    m.and('G1', ['G11', 'G12']);
    assert.ok(!has(m.model(), 'security', 'noRedelegation'));
    m.delegate('G12', 'C');
    const [f] = findingsOf(m.model(), 'security', 'noRedelegation');
    assert.deepStrictEqual(
      [f?.details?.requester, f?.details?.responsible, f?.details?.redelegated],
      ['A', 'B', 'G12'],
    );
  });

  it('noRedelegation: not without the need', () => {
    const { m } = delegation();
    m.role('C');
    m.delegate('G@B', 'C');
    assert.ok(!has(m.model(), 'security', 'noRedelegation'));
  });

  it('singleRedundancy: no OR-decomposition, or an alternative delegated', () => {
    const { m, copy } = delegation({ redundancy: 'trueSingleActor' });
    assert.ok(has(m.model(), 'security', 'singleRedundancy'));
    m.goal('B', 'G1');
    m.goal('B', 'G2');
    m.or(copy, ['G1', 'G2']);
    assert.ok(!has(m.model(), 'security', 'singleRedundancy'));
    m.role('C');
    m.delegate('G2', 'C');
    assert.ok(has(m.model(), 'security', 'singleRedundancy'));
  });

  it('multiRedundancy: no OR-decomposition, or no alternative involving another actor', () => {
    const { m, copy } = delegation({ redundancy: 'fallbackMultiActor' });
    m.goal('B', 'G1');
    m.goal('B', 'G2');
    m.or(copy, ['G1', 'G2']);
    assert.ok(has(m.model(), 'security', 'multiRedundancy'));
    m.role('C');
    m.delegate('G2', 'C');
    assert.ok(!has(m.model(), 'security', 'multiRedundancy'));
  });
});

describe('STS-ml security analysis: information (DKE Table 7, Def. 4)', () => {
  /** O owns I, made tangible by A's document D, which A's goal G uses. */
  const using = (use: 'reads' | 'modifies' | 'produces') => {
    const m = stsModel();
    m.role('O');
    m.role('A');
    m.goal('A', 'G');
    m.goal('A', 'H');
    m.goal('A', 'R');
    m.and('R', ['G', 'H']);
    m.document('A', 'D');
    m.information('I');
    m.owns('O', 'I');
    m.tangible('I', 'D');
    m[use]('G', 'D');
    return m;
  };
  const cases = [
    ['reads', 'read', 'nonReading'],
    ['modifies', 'modify', 'nonModification'],
    ['produces', 'produce', 'nonProduction'],
  ] as const;
  for (const [use, operation, kind] of cases)
    it(`${kind}: no authorisation grants it (closure), or one prohibits it`, () => {
      const m = using(use);
      const [implicit] = findingsOf(m.model(), 'security', kind);
      assert.deepStrictEqual(
        [implicit?.details?.requester, implicit?.details?.explicit],
        ['O', 'false'],
      );
      m.authorise('O', 'A', { information: ['I'], granted: [operation] });
      assert.ok(!has(m.model(), 'security', kind));
      m.role('P');
      m.authorise('P', 'A', { information: ['I'], prohibited: [operation] });
      const [explicit] = findingsOf(m.model(), 'security', kind);
      assert.deepStrictEqual(
        [explicit?.details?.requester, explicit?.details?.explicit],
        ['P', 'true'],
      );
    });

  it('a document conveying a whole through a part: judged on that part (#160 D-G4)', () => {
    const m = using('reads');
    m.information('W');
    m.partOf('I', 'W');
    m.owns('O', 'W');
    m.role('X');
    // W's owner is O, and A reads W only through I: a right on I suffices
    m.authorise('O', 'A', { information: ['I'], granted: ['read'] });
    assert.ok(!has(m.model(), 'security', 'nonReading'));
  });

  it('needToKnow: authorised for some goals, used for another', () => {
    const m = using('reads');
    m.authorise('O', 'A', {
      information: ['I'],
      scope: ['H'],
      granted: ['read'],
    });
    const [f] = findingsOf(m.model(), 'security', 'needToKnow');
    assert.strictEqual(f?.details?.goal, 'G');
    assert.ok(!has(m.model(), 'security', 'nonReading'));
    const n = using('reads');
    n.authorise('O', 'A', {
      information: ['I'],
      scope: ['R'],
      granted: ['read'],
    });
    assert.ok(!has(n.model(), 'security', 'needToKnow'));
  });

  it('a use in either OR-alternative is possible: some variant takes it (#160 D-G10)', () => {
    const m = stsModel();
    m.role('O');
    m.role('A');
    ['R', 'G', 'H'].forEach((g) => m.goal('A', g));
    m.or('R', ['G', 'H']);
    m.document('A', 'D');
    m.information('I');
    m.owns('O', 'I');
    m.tangible('I', 'D');
    m.reads('G', 'D');
    m.modifies('H', 'D');
    assert.ok(has(m.model(), 'security', 'nonReading'));
    assert.ok(has(m.model(), 'security', 'nonModification'));
  });

  it('nonDisclosure: a transmission of a document conveying information without T', () => {
    const m = stsModel();
    m.role('O');
    m.role('A');
    m.role('B');
    m.document('A', 'D');
    m.information('I');
    m.owns('O', 'I');
    m.tangible('I', 'D');
    m.transmit('D', 'B');
    const [f] = findingsOf(m.model(), 'security', 'nonDisclosure');
    assert.strictEqual(f?.details?.to, 'B');
    m.authorise('O', 'A', { information: ['I'], granted: ['transmit'] });
    assert.ok(!has(m.model(), 'security', 'nonDisclosure'));
  });

  it('nonDisclosure: a received document passed on, by the receiver', () => {
    const m = stsModel();
    ['O', 'A', 'B', 'C'].forEach((x) => m.role(x));
    m.document('A', 'D');
    m.information('I');
    m.owns('O', 'I');
    m.tangible('I', 'D');
    m.authorise('O', 'A', { information: ['I'], granted: ['transmit'] });
    const { copy } = m.transmit('D', 'B');
    assert.ok(!has(m.model(), 'security', 'nonDisclosure'));
    m.transmit(copy, 'C');
    const [f] = findingsOf(m.model(), 'security', 'nonDisclosure');
    assert.deepStrictEqual(
      [f?.details?.responsible, f?.details?.to],
      ['B', 'C'],
    );
  });

  it('nonReauthorisation: received non-transferably, passed on', () => {
    const m = stsModel();
    ['O', 'A', 'B'].forEach((x) => m.role(x));
    m.information('I');
    m.owns('O', 'I');
    m.authorise('O', 'A', {
      information: ['I'],
      granted: ['read'],
      transferable: false,
    });
    assert.ok(!has(m.model(), 'security', 'nonReauthorisation'));
    m.authorise('A', 'B', { information: ['I'], granted: ['read'] });
    const [f] = findingsOf(m.model(), 'security', 'nonReauthorisation');
    assert.deepStrictEqual([f?.details?.requester, f?.details?.to], ['O', 'B']);
  });

  it('nonReauthorisationOperation: granting an operation one has no right to; the owner may', () => {
    const m = stsModel();
    ['O', 'A', 'B'].forEach((x) => m.role(x));
    m.information('I');
    m.owns('O', 'I');
    m.authorise('O', 'A', { information: ['I'], granted: ['read'] });
    m.authorise('A', 'B', { information: ['I'], granted: ['read', 'modify'] });
    m.authorise('O', 'B', { information: ['I'], granted: ['produce'] });
    assert.deepStrictEqual(
      findingsOf(m.model(), 'security', 'nonReauthorisationOperation').map(
        (f) => [f.details?.responsible, f.details?.operation],
      ),
      [['A', 'modify']],
    );
  });
});

describe('STS-ml security analysis: duties (DKE R23–R26)', () => {
  it('roleSod and roleCod: an agent playing both, or only one', () => {
    const m = stsModel();
    m.role('R1');
    m.role('R2');
    m.agent('X');
    m.sod('R1', 'R2');
    m.plays('X', 'R1');
    assert.ok(!has(m.model(), 'security', 'roleSod'));
    m.plays('X', 'R2');
    assert.ok(has(m.model(), 'security', 'roleSod'));
    const n = stsModel();
    n.role('R1');
    n.role('R2');
    n.agent('X');
    n.cod('R1', 'R2');
    n.plays('X', 'R1');
    assert.ok(has(n.model(), 'security', 'roleCod'));
    n.plays('X', 'R2');
    assert.ok(!has(n.model(), 'security', 'roleCod'));
  });

  it('goalSod: one actor pursues both, delegating one or not; never OR-alternatives', () => {
    const build = (or: boolean) => {
      const m = stsModel();
      m.agent('A');
      m.agent('B');
      ['G', 'G1', 'G2'].forEach((g) => m.goal('A', g));
      (or ? m.or : m.and)('G', ['G1', 'G2']);
      m.delegate('G2', 'B');
      m.sod('G1', 'G2');
      return m.model();
    };
    const [f] = findingsOf(build(false), 'security', 'goalSod');
    assert.strictEqual(f?.details?.witnesses, 'A');
    assert.ok(!has(build(true), 'security', 'goalSod'));
  });

  it('goalCod: an agent finally performing one and not the other is an error', () => {
    const m = stsModel();
    m.agent('A');
    m.agent('B');
    ['G', 'G1', 'G2'].forEach((g) => m.goal('A', g));
    m.and('G', ['G1', 'G2']);
    m.cod('G1', 'G2');
    assert.ok(!has(m.model(), 'security', 'goalCod'));
    m.delegate('G2', 'B');
    const [f] = findingsOf(m.model(), 'security', 'goalCod');
    assert.strictEqual(f?.severity, 'error');
  });

  it('goalCod: a role no agent plays performing both is a warning (NESSoS Fig. 37)', () => {
    const m = stsModel();
    m.role('A');
    ['G', 'G1', 'G2'].forEach((g) => m.goal('A', g));
    m.and('G', ['G1', 'G2']);
    m.cod('G1', 'G2');
    const [f] = findingsOf(m.model(), 'security', 'goalCod');
    assert.strictEqual(f?.severity, 'warning');
    m.agent('X');
    m.plays('X', 'A');
    assert.ok(!has(m.model(), 'security', 'goalCod'));
  });
});

describe('STS-ml threat analysis (IJSSE 2014 Table 2; manual App. C)', () => {
  it('threatPropagation: AND-parents, delegators, produced documents, readers, receivers, parts', () => {
    const m = stsModel();
    m.role('A');
    m.role('B');
    ['R', 'G1', 'G2', 'O', 'O1', 'O2'].forEach((g) => m.goal('A', g));
    m.and('R', ['G1', 'G2']);
    m.or('O', ['O1', 'O2']);
    const { copy } = m.delegate('G1', 'B');
    m.document('B', 'D');
    m.document('B', 'P');
    m.partOf('P', 'D');
    m.produces(copy, 'D');
    m.document('A', 'E');
    m.reads('O1', 'E');
    m.event('X');
    m.threatens('X', copy);
    const [f] = findingsOf(m.model(), 'threats', 'threatPropagation');
    assert.deepStrictEqual(
      [...f!.elements].sort(),
      ['D', 'G1', 'G1@B', 'P', 'R', 'X'].sort(),
    );
    // an OR-parent is not threatened (#160 D-G8), information never is
    const n = stsModel();
    n.role('A');
    ['O', 'O1', 'O2'].forEach((g) => n.goal('A', g));
    n.or('O', ['O1', 'O2']);
    n.event('X');
    n.threatens('X', 'O1');
    const [g] = findingsOf(n.model(), 'threats', 'threatPropagation');
    assert.deepStrictEqual(g?.elements, ['X', 'O1']);
  });

  it('threatPropagation: a threatened transmission threatens the receiver’s document', () => {
    const m = stsModel();
    m.role('A');
    m.role('B');
    m.document('A', 'D');
    const t = m.transmit('D', 'B');
    m.goal('B', 'G');
    m.reads('G', t.copy);
    m.event('X');
    m.set(t.link, 'threatenedBy', m.ref('X'));
    const [f] = findingsOf(m.model(), 'threats', 'threatPropagation');
    assert.deepStrictEqual(f?.elements, ['X', 'D@B', 'G']);
    assert.deepStrictEqual(f?.links, [t.link]);
    const n = stsModel();
    n.event('X');
    assert.ok(!has(n.model(), 'threats', 'threatPropagation'));
  });
});

describe('STS-ml derived security requirements (DKE §3.2)', () => {
  it('a need gives a requirement the other way round; R1 and R10 bind the delegator', () => {
    const { m, link } = delegation({
      noRedelegation: 'true',
      nonRepudiation: 'delegationAcceptance',
      authentication: 'delegator',
      availability: '95',
    });
    const rows = runStsAnalyses(m.model()).requirements.map((r) => [
      r.requirement,
      r.responsible,
      r.requester,
      r.link,
    ]);
    assert.deepStrictEqual(
      rows.sort(),
      [
        ['delegator-authentication', 'A', 'B', link],
        ['goal-availability', 'B', 'A', link],
        ['no-redelegation', 'B', 'A', link],
        ['non-repudiation-of-acceptance', 'B', 'A', link],
        ['non-repudiation-of-delegation', 'A', 'B', link],
      ].sort(),
    );
  });

  it('an authorisation gives need-to-know, its prohibitions and non-reauthorisation; duties bind all agents', () => {
    const m = stsModel();
    m.role('A');
    m.role('B');
    m.goal('B', 'G');
    m.goal('B', 'H');
    m.information('I');
    m.authorise('A', 'B', {
      information: ['I'],
      scope: ['G'],
      granted: ['read'],
      prohibited: ['transmit'],
      transferable: false,
    });
    m.sod('G', 'H');
    assert.deepStrictEqual(
      runStsAnalyses(m.model()).requirements.map((r) => [
        r.requirement,
        r.number,
        r.responsible,
      ]),
      [
        ['need-to-know', 27, 'B'],
        ['non-disclosure', 31, 'B'],
        ['non-reauthorisation', 32, 'B'],
        ['goal-sod', 24, '(all agents)'],
      ],
    );
  });
});

describe('STS-ml analyses: reading the dialect’s model', () => {
  it('leaves out an authorisation whose scope is not a list, rather than read it as every goal', () => {
    const m = stsModel();
    ['O', 'A'].forEach((x) => m.role(x));
    m.goal('A', 'G');
    m.document('A', 'D');
    m.information('I');
    m.owns('O', 'I');
    m.tangible('I', 'D');
    m.reads('G', 'D');
    const auth = m.authorise('O', 'A', {
      information: ['I'],
      granted: ['read'],
    });
    assert.ok(!has(m.model(), 'security', 'nonReading'));
    m.set(auth, 'scope', `${m.ref('G')} H`);
    assert.ok(has(m.model(), 'security', 'nonReading'));
  });
});

describe('STS-ml analyses for the workbench', () => {
  it('each gives one case of findings', () => {
    const { m } = delegation({ noRedelegation: 'true' });
    m.role('C');
    m.delegate('G@B', 'C');
    const result = stsSecurityAnalyses.security.run(m.model());
    assert.strictEqual(result.cases.length, 1);
    assert.deepStrictEqual(
      result.cases[0]!.findings?.map((f) => f.kind),
      ['noRedelegation'],
    );
  });
});

describe('STS-ml worked examples (#160 R1)', () => {
  it('DKE §4.2.1, Fig. 3: Municipality and Tax Agency conflict on InfoTN’s production', () => {
    const m = stsModel();
    ['Municipality', 'TaxAgency', 'InfoTN', 'Citizen'].forEach((x) =>
      m.role(x),
    );
    ['systemMaintained', 'dataCompletenessEnsured', 'dataRefined'].forEach(
      (g) => m.goal('InfoTN', g),
    );
    m.and('systemMaintained', ['dataCompletenessEnsured']);
    m.and('dataCompletenessEnsured', ['dataRefined']);
    const infos = ['personalInfo', 'residentialAddress', 'taxContributions'];
    infos.forEach((i) => m.information(i));
    m.owns('Citizen', 'personalInfo');
    m.owns('Municipality', 'residentialAddress');
    m.owns('Municipality', 'taxContributions');
    m.authorise('Municipality', 'InfoTN', {
      information: infos,
      scope: ['systemMaintained'],
      granted: ['read'],
      prohibited: ['produce'],
    });
    m.authorise('TaxAgency', 'InfoTN', {
      information: infos,
      scope: ['dataRefined'],
      granted: ['modify', 'produce'],
    });
    // ids as text ids: a refList reads only ids (refListItems)
    assert.deepStrictEqual(
      findingsOf(m.model(), 'security', 'authorisationConflict').map((f) => [
        f.details?.information,
        f.details?.on,
      ]),
      infos.map((i) => [i, 'produce']),
    );
  });
});
