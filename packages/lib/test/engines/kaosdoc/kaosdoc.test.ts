/**
 * kaosdoc (goal-controller#171): DSM3's KAOS example as a requirements
 * document, byte for byte as committed next to the seed, and what each table
 * reads of a model.
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { describe, it } from 'mocha';
import {
  kaosdocDocument,
  kaosdocGoalModel,
  kaosdocOutput,
  readKaosModel,
} from '../../../src/engines/kaosdoc';

const SEED = '../../examples/kaos/kaos-welcome.txt';
const EXPECTED = '../../examples/kaos/kaos-welcome.expected.md';
const seed = readFileSync(SEED, 'utf8');
const documentOf = (text: string) =>
  kaosdocDocument(kaosdocGoalModel(readKaosModel(text)), {
    title: 'kaos-welcome',
  });

/** The seed with an element's custom properties set, by its text. */
const withProperties = (
  text: string,
  properties: Record<string, Record<string, string>>,
): string => {
  const json = JSON.parse(text);
  for (const element of [
    ...json.orphans,
    ...json.links.flatMap((l: { hub?: unknown }) => (l.hub ? [l.hub] : [])),
  ])
    if (properties[element.text ?? element.id])
      element.customProperties = {
        ...element.customProperties,
        ...properties[element.text ?? element.id],
      };
  return JSON.stringify(json);
};

describe('kaosdoc: a requirements document from a KAOS model', () => {
  it("writes DSM3's example as committed next to it", () => {
    assert.strictEqual(documentOf(seed), readFileSync(EXPECTED, 'utf8'));
  });

  it('writes one Markdown file, named after the model', () => {
    const { files } = kaosdocOutput(kaosdocGoalModel(readKaosModel(seed)), {
      modelName: 'kaos-welcome.txt',
    });
    assert.deepStrictEqual(
      files.map(({ id, fileName, primary }) => ({ id, fileName, primary })),
      [{ id: 'document', fileName: 'kaos-welcome.md', primary: true }],
    );
    assert.ok(
      files[0]!.text.startsWith('# Requirements document: kaos-welcome\n'),
    );
  });

  it('lists fit criteria, the other details of the goals that have any, and a hub’s properties', () => {
    const text = withProperties(seed, {
      'Achieve [Manual Backup]': {
        FitCriterion: '  a backup a week, at least ',
        FormalSpec: 'BackupRequested => <>_{≤1w} BackedUp',
        Issue: 'who | when',
      },
      'bdc418b6-66a8-4811-9ee9-9babe81d285d': { Tactic: 'by cases' },
    });
    const document = documentOf(text);
    assert.match(
      document,
      /\| Achieve \[Manual Backup\] \| Behavioral goal \|  \|  \|  \| a backup a week, at least \|/,
    );
    assert.match(
      document,
      /## Goal details\n\n\| Goal \| Source \| Stability \| Formal specification \| Issue \|\n\| --- .*\n\| Achieve \[Manual Backup\] \|  \|  \| BackupRequested => <>_\{≤1w\} BackedUp \| who \\\| when \|\n\n/,
    );
    // #226: changed (was '| by cases |'): a Tactic outside its vocabulary is
    // unset on the hub’s entry, so the cell is empty
    assert.match(
      document,
      /\| Maintain \[Minimal Interval Between Automatic Backups\] \| Internet connection available \|  \|  \|/,
    );
  });

  it('calls a leaf goal of a system agent a requirement, of both kinds shared', () => {
    const json = JSON.parse(seed);
    json.orphans.push({
      id: 'sys',
      text: 'Backup daemon',
      type: 'kaos.Agent',
      x: 0,
      y: 0,
    });
    json.links.push(
      {
        id: 'r1',
        type: 'kaos.ResponsibilityAssignment',
        source: 'sys',
        target: 'f0a633b9-cead-4961-9764-eeb6c3a6c41c',
      },
      {
        id: 'r2',
        type: 'kaos.ResponsibilityAssignment',
        source: 'sys',
        target: '1938d85d-0e68-44ee-8cc1-6fc555a202e7',
      },
    );
    const document = documentOf(JSON.stringify(json));
    assert.match(
      document,
      /\| Achieve \[Problem Notified if Problem\] \| Backup daemon \| requirement \|/,
    );
    assert.match(
      document,
      /\| Achieve \[Manual Backup\] \| User, Backup daemon \| shared \|/,
    );
    assert.match(
      document,
      /\| Backup daemon \| Agent \| Achieve \[Problem Notified if Problem\], Achieve \[Manual Backup\] \|/,
    );
  });

  it('names a goal by its text, its id with it', () => {
    const document = documentOf(seed.replace('"Backup"', '"G2: Backup"'));
    assert.match(document, /\| G2: Backup \| Softgoal \|/);
  });
});

describe('kaosdoc: obstacles (#181)', () => {
  /** istar-ts's LAS: KAOSTools' London Ambulance, with obstacle analysis */
  const las = readFileSync('test/dialect/fixtures/kaos-las.txt', 'utf8');
  const sectionOf = (doc: string, heading: string) =>
    doc.split(`\n## ${heading}\n\n`)[1]?.split('\n\n## ')[0];

  it('lists each obstacle in its tree’s order: what it obstructs, what resolves it and how', () => {
    assert.strictEqual(
      sectionOf(documentOf(las), 'Obstacles'),
      [
        '| Obstacle | Category | Obstructs | Resolved by | Resolution |',
        '| --- | --- | --- | --- | --- |',
        '| Mobilized Ambulance Not On Scene in Time |  | Achieve [Ambulance On Scene When Ambulance Mobilized] |  |  |',
        '| Ambulance Stuck In Traffic Jam |  |  |  |  |',
        '| Ambulance Lost |  |  |  |  |',
        '| Ambulance Not In Familiar Area |  |  | Avoid [Ambulance Not In Familiar Area] | mitigation, anchored on Achieve [Ambulance On Scene When Ambulance Mobilized] |',
        '| GPS Not Working |  |  |  |  |',
        '| Ambulance Broken Down |  |  |  |  |',
        '',
      ].join('\n'),
    );
  });

  it('has no Obstacles section without obstacles (DSM3’s KAOS has none)', () => {
    assert.strictEqual(sectionOf(documentOf(seed), 'Obstacles'), undefined);
  });
});

describe('kaosdoc: threats, anti-goals ridden on the obstacle machinery (van Lamsweerde ICSE’04, #212)', () => {
  const las = readFileSync('test/dialect/fixtures/kaos-las.txt', 'utf8');
  const sectionOf = (doc: string, heading: string) =>
    doc.split(`\n## ${heading}\n\n`)[1]?.split('\n\n## ')[0];
  const AMBULANCE_LOST = 'ambulance_lost';

  /** `las` with an obstacle’s Category set to AntiGoal and an agent assigned to it */
  const antiModel = (agentType: string) => {
    const json = JSON.parse(las);
    for (const orphan of json.orphans)
      if (orphan.id === AMBULANCE_LOST)
        orphan.customProperties = {
          ...orphan.customProperties,
          Category: 'AntiGoal',
        };
    json.orphans.push({
      id: 'thief',
      text: 'Thief',
      type: 'kaos.Agent',
      x: 0,
      y: 0,
      ...(agentType && { customProperties: { Type: agentType } }),
    });
    json.links.push({
      id: 'r1',
      type: 'kaos.ResponsibilityAssignment',
      source: 'thief',
      target: AMBULANCE_LOST,
    });
    return JSON.stringify(json);
  };

  it('a leaf anti-goal assigned to a malicious agent is an anti-requirement', () => {
    assert.strictEqual(
      sectionOf(documentOf(antiModel('malicious')), 'Threats'),
      [
        '| Anti-goal | Obstructs | Assigned to | As |',
        '| --- | --- | --- | --- |',
        '| Ambulance Lost |  | Thief | anti-requirement |',
      ].join('\n'),
    );
  });

  it('assigned to a plain (attackee) agent, it is a vulnerability', () => {
    assert.strictEqual(
      sectionOf(documentOf(antiModel('')), 'Threats'),
      [
        '| Anti-goal | Obstructs | Assigned to | As |',
        '| --- | --- | --- | --- |',
        '| Ambulance Lost |  | Thief | vulnerability |',
      ].join('\n'),
    );
  });

  it('unassigned, it is just an anti-goal (an interior node of the attacker’s own tree)', () => {
    const json = JSON.parse(las);
    for (const orphan of json.orphans)
      if (orphan.id === AMBULANCE_LOST)
        orphan.customProperties = {
          ...orphan.customProperties,
          Category: 'AntiGoal',
        };
    assert.strictEqual(
      sectionOf(documentOf(JSON.stringify(json)), 'Threats'),
      [
        '| Anti-goal | Obstructs | Assigned to | As |',
        '| --- | --- | --- | --- |',
        '| Ambulance Lost |  |  | anti-goal |',
      ].join('\n'),
    );
  });

  it('has no Threats section without an AntiGoal obstacle', () => {
    assert.strictEqual(sectionOf(documentOf(las), 'Threats'), undefined);
  });
});

describe('kaosdoc: the Elevator tutorial seed, operations side (#210)', () => {
  const elevator = readFileSync(
    '../../examples/kaos/elevator/elevator.txt',
    'utf8',
  );
  const expected = readFileSync(
    '../../examples/kaos/elevator/elevator.expected.md',
    'utf8',
  );

  it('writes the same document as committed next to the seed', () => {
    assert.strictEqual(
      kaosdocDocument(kaosdocGoalModel(readKaosModel(elevator)), {
        title: 'elevator',
      }),
      expected,
    );
  });

  it('has no section for operations or objects: its mapper ignores kaosOperations kinds (D3 of #195)', () => {
    const document = kaosdocDocument(
      kaosdocGoalModel(readKaosModel(elevator)),
      { title: 'elevator' },
    );
    for (const heading of ['Operations', 'Entities', 'Associations', 'Events'])
      assert.ok(
        !document.includes(`## ${heading}`),
        `unexpected section ${heading}`,
      );
  });
});
