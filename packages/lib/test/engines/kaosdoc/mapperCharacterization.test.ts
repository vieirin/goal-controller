/**
 * kaosdocEngineMapper, characterized (goal-controller#187 phase 2 pre-work):
 * what its IR holds for every property a KAOS element or link carries, so
 * the migration to typed values can show nothing changed. Goal nodes and
 * links keep the properties their kind has, as the dialect reads them
 * (trimmed, empty ones left out); the model's elements (a refinement's hub,
 * an obstacle's Category in the document) keep theirs as written. A value
 * outside a vocabulary was kept as text before #187: now the mapper is
 * given `undefined` for it and leaves it out, and the dialect's checks
 * report it (`#187: invalid value`); a link keeps its own kind's keys only.
 */
import * as assert from 'assert';
import { readFileSync } from 'fs';
import { describe, it } from 'mocha';
import type { GoalNode, TreeNode } from '@goal-controller/goal-tree';
import {
  KAOSDOC_DOMAIN_PROPERTY_KEYS,
  KAOSDOC_GOAL_KEYS,
  KAOSDOC_LINK_KEYS,
  kaosdocDocument,
  kaosdocGoalModel,
  readKaosModel,
  type KaosdocNodeProps,
} from '../../../src/engines/kaosdoc';

const SEED = readFileSync('../../examples/kaos/kaos-welcome.txt', 'utf8');
const LAS = readFileSync('test/dialect/fixtures/kaos-las.txt', 'utf8');

const SOFTGOAL = '7857cb00-05ce-4bd0-aa89-3c7a63b54b31'; // Reliability
const GOAL = '1938d85d-0e68-44ee-8cc1-6fc555a202e7'; // Achieve [Manual Backup]
const DOMAIN_PROPERTY = 'b7293d46-6a83-4a68-a3e1-d4c2a3552ddd';
const AGENT = '07ce5838-94b3-45b6-9e7c-f5b806f5b5b1'; // User
const HUB = 'bdc418b6-66a8-4811-9ee9-9babe81d285d';
const CONFLICT = '4c7146d5-b85c-4061-a307-5b11647c8cfc';
const ASSIGNMENT = 'ee457c48-a5d6-4846-915e-aeffeba6d3ca';
const OBSTACLE = 'ambulance_lost';
const RESOLUTION = 'resolution-familiar-area';

type Json = {
  orphans: { id: string; customProperties?: Record<string, string> }[];
  links: {
    id?: string;
    hub?: { id: string; customProperties?: Record<string, string> };
    customProperties?: Record<string, string>;
  }[];
};

/** A model's text with custom properties replaced, by element, hub or link id. */
const withProperties = (
  text: string,
  properties: Record<string, Record<string, string>>,
): string => {
  const json = JSON.parse(text) as Json;
  for (const item of [
    ...json.orphans,
    ...json.links,
    ...json.links.flatMap((link) => (link.hub ? [link.hub] : [])),
  ])
    if (item.id && properties[item.id])
      item.customProperties = properties[item.id];
  return JSON.stringify(json);
};

const modelOf = (text: string) => kaosdocGoalModel(readKaosModel(text));

/** A goal node's engine properties, found in the paper's trees. */
const nodeEngine = (text: string, id: string): KaosdocNodeProps => {
  const find = (
    nodes: readonly TreeNode<KaosdocNodeProps>[],
  ): GoalNode<KaosdocNodeProps> | undefined => {
    for (const node of nodes) {
      if (node.type !== 'goal') continue;
      if (node.iStarId === id) return node;
      const found = find(node.children ?? []);
      if (found) return found;
    }
    return undefined;
  };
  const node = find(modelOf(text).paper);
  if (!node) throw new Error(`${id} is no goal node`);
  return node.properties.engine;
};

const linkEngine = (text: string, id: string) => {
  const link = modelOf(text).links.find((l) => l.id === id);
  if (!link) throw new Error(`${id} is no link`);
  return link.properties.engine;
};

const elementProperties = (text: string, id: string) => {
  const element = modelOf(text).elements.find((e) => e.id === id);
  if (!element) throw new Error(`${id} is no element`);
  return element.properties;
};

const sectionOf = (text: string, heading: string) =>
  kaosdocDocument(modelOf(text), { title: 't' })
    .split(`\n## ${heading}\n\n`)[1]
    ?.split('\n\n## ')[0];

describe('kaosdocEngineMapper: characterization (#187)', () => {
  it('reads these keys', () => {
    assert.deepStrictEqual(KAOSDOC_GOAL_KEYS, [
      'Type',
      'Category',
      'Source',
      'Priority',
      'Issue',
      'FormalSpec',
      'FitCriterion',
      'Stability',
      'Description',
    ]);
    assert.deepStrictEqual(KAOSDOC_DOMAIN_PROPERTY_KEYS, [
      'Kind',
      'Description',
    ]);
    assert.deepStrictEqual(KAOSDOC_LINK_KEYS, [
      'BoundaryCondition',
      'ResolutionType',
      'Anchor',
    ]);
  });

  describe('goals', () => {
    it('trims every goal key set, in the keys’ order, leaving out empty, blank and absent ones', () => {
      const engine = nodeEngine(
        withProperties(SEED, {
          [GOAL]: {
            Stability: ' stable ',
            FitCriterion: '\n a backup a week \n',
            FormalSpec: '  BackupRequested => <>_{≤1w} BackedUp  ',
            Issue: '\t',
            Priority: ' high',
            Source: '',
            Category: 'Safety ',
            Type: ' Achieve ',
            Description: 'line one\nline two',
          },
        }),
        GOAL,
      );
      assert.deepStrictEqual(engine, {
        kind: 'kaos.BehavioralGoal',
        properties: {
          Type: 'Achieve',
          Category: 'Safety',
          Priority: 'high',
          FormalSpec: 'BackupRequested => <>_{≤1w} BackedUp',
          FitCriterion: 'a backup a week',
          Stability: 'stable',
          Description: 'line one\nline two',
        },
      });
      assert.deepStrictEqual(Object.keys(engine.properties), [
        'Type',
        'Category',
        'Priority',
        'FormalSpec',
        'FitCriterion',
        'Stability',
        'Description',
      ]);
    });

    it('leaves out the keys a goal does not read', () => {
      assert.deepStrictEqual(
        nodeEngine(
          withProperties(SEED, {
            [GOAL]: {
              Kind: 'invariant',
              RSR: '0.95',
              Tactic: 'case-driven',
              BoundaryCondition: 'x',
              selected: 'true',
            },
          }),
          GOAL,
        ),
        { kind: 'kaos.BehavioralGoal', properties: {} },
      );
    });

    it('a softgoal reads a behavioral goal’s keys', () => {
      assert.deepStrictEqual(
        nodeEngine(
          withProperties(SEED, {
            [SOFTGOAL]: {
              Type: 'softgoal',
              Priority: 'low',
              Description: ' d ',
              Kind: 'hypothesis',
            },
          }),
          SOFTGOAL,
        ),
        {
          kind: 'kaos.Softgoal',
          properties: { Type: 'softgoal', Priority: 'low', Description: 'd' },
        },
      );
    });

    it('leaves out a value outside its vocabulary', () => {
      // #187: invalid value (was kept, trimmed)
      assert.deepStrictEqual(
        nodeEngine(
          withProperties(SEED, {
            [GOAL]: {
              Type: 'achieve',
              Category: 'Hazard',
              Priority: ' HIGH ',
            },
          }),
          GOAL,
        ).properties,
        {},
      );
    });

    it('leaves a value outside its vocabulary out of the Goals table', () => {
      // #187: invalid value (was written)
      const goals = sectionOf(
        withProperties(SEED, {
          [GOAL]: { Type: 'Bogus', Category: 'nope', Priority: 'urgent' },
        }),
        'Goals',
      );
      assert.ok(
        goals!.includes(
          '| Achieve [Manual Backup] | Behavioral goal |  |  |  |  |',
        ),
      );
    });
  });

  describe('domain properties', () => {
    it('reads Kind and Description, trimmed, and nothing else', () => {
      assert.deepStrictEqual(
        nodeEngine(
          withProperties(SEED, {
            [DOMAIN_PROPERTY]: {
              Kind: ' invariant ',
              Description: ' always ',
              Type: 'Achieve',
              Priority: 'high',
            },
          }),
          DOMAIN_PROPERTY,
        ),
        {
          kind: 'kaos.DomainProperty',
          properties: { Kind: 'invariant', Description: 'always' },
        },
      );
    });

    it('leaves out a Kind outside its vocabulary', () => {
      // #187: invalid value (was kept)
      assert.deepStrictEqual(
        nodeEngine(
          withProperties(SEED, { [DOMAIN_PROPERTY]: { Kind: 'Axiom' } }),
          DOMAIN_PROPERTY,
        ).properties,
        {},
      );
    });

    it('the document reads its Description from the element, as written, the cell trimmed', () => {
      const text = withProperties(SEED, {
        [DOMAIN_PROPERTY]: { Description: '  needs | a link  ', Kind: '' },
      });
      assert.deepStrictEqual(elementProperties(text, DOMAIN_PROPERTY), {
        Description: '  needs | a link  ',
        Kind: '',
      });
      assert.ok(
        sectionOf(text, 'Domain properties')!.includes(
          '| Internet connection available | needs \\| a link |',
        ),
      );
    });
  });

  describe('obstacles', () => {
    it('reads Description, FormalSpec and Category, trimmed, and nothing else', () => {
      assert.deepStrictEqual(
        nodeEngine(
          withProperties(LAS, {
            [OBSTACLE]: {
              Description: ' lost ',
              FormalSpec: ' sooner-or-later lost() ',
              Category: ' Hazard ',
              Type: 'Avoid',
              Priority: 'high',
            },
          }),
          OBSTACLE,
        ),
        {
          kind: 'kaosObstacles.Obstacle',
          properties: {
            Description: 'lost',
            FormalSpec: 'sooner-or-later lost()',
            Category: 'Hazard',
          },
        },
      );
    });

    it('leaves out a Category outside the obstacles’ vocabulary (a goal’s)', () => {
      // #187: invalid value (was kept)
      assert.deepStrictEqual(
        nodeEngine(
          withProperties(LAS, { [OBSTACLE]: { Category: 'Satisfaction' } }),
          OBSTACLE,
        ).properties,
        {},
      );
    });

    it('the Obstacles table reads Category from the element, the cell trimmed, any value written', () => {
      const row = (Category: string) =>
        sectionOf(
          withProperties(LAS, { [OBSTACLE]: { Category } }),
          'Obstacles',
        )!
          .split('\n')
          .find((line) => line.startsWith('| Ambulance Lost |'));
      assert.strictEqual(
        row(' Hazard '),
        '| Ambulance Lost | Hazard |  |  |  |',
      );
      // #187: invalid value
      assert.strictEqual(
        row('Satisfaction'),
        '| Ambulance Lost | Satisfaction |  |  |  |',
      );
    });
  });

  describe('links', () => {
    it('a conflict’s BoundaryCondition, trimmed; empty or blank left out', () => {
      const conflict = (BoundaryCondition: string) =>
        linkEngine(
          withProperties(SEED, { [CONFLICT]: { BoundaryCondition } }),
          CONFLICT,
        );
      assert.deepStrictEqual(conflict('  offline \n'), {
        BoundaryCondition: 'offline',
      });
      assert.deepStrictEqual(conflict(''), {});
      assert.deepStrictEqual(conflict('   '), {});
      assert.deepStrictEqual(conflict(' offline\nat night '), {
        BoundaryCondition: 'offline\nat night',
      });
    });

    it('a link reads its own kind’s keys only', () => {
      // #187: link keys on the wrong kind (every link kind read every link key)
      assert.deepStrictEqual(
        linkEngine(
          withProperties(SEED, {
            [CONFLICT]: {
              BoundaryCondition: 'b',
              ResolutionType: 'mitigation',
              Anchor: GOAL,
              Description: 'not a link key',
            },
          }),
          CONFLICT,
        ),
        { BoundaryCondition: 'b' },
      );
      // #187: link keys on the wrong kind
      assert.deepStrictEqual(
        linkEngine(
          withProperties(SEED, {
            [ASSIGNMENT]: { BoundaryCondition: ' x ', Tactic: 'case' },
          }),
          ASSIGNMENT,
        ),
        {},
      );
    });

    it('a resolution’s ResolutionType and Anchor, trimmed', () => {
      assert.deepStrictEqual(
        linkEngine(
          withProperties(LAS, {
            [RESOLUTION]: {
              ResolutionType: ' obstacle mitigation ',
              Anchor: ' achieve_ambulance_on_scene_when_ambulance_mobilized ',
              BoundaryCondition: '',
            },
          }),
          RESOLUTION,
        ),
        {
          ResolutionType: 'obstacle mitigation',
          Anchor: 'achieve_ambulance_on_scene_when_ambulance_mobilized',
        },
      );
    });

    it('leaves out a ResolutionType outside its vocabulary, and an Anchor naming no goal', () => {
      // #187: invalid value (the ResolutionType was kept). #243: changed (the
      // Anchor was kept): a reference resolves against the model, and one
      // naming no element is unset, as the dialect reports it
      assert.deepStrictEqual(
        linkEngine(
          withProperties(LAS, {
            [RESOLUTION]: { ResolutionType: 'Mitigation', Anchor: 'nowhere' },
          }),
          RESOLUTION,
        ),
        {},
      );
    });

    it('the Resolution cell: the type, its anchor by name, by id prefix, or as written', () => {
      const resolution = (properties: Record<string, string>) =>
        sectionOf(
          withProperties(LAS, { [RESOLUTION]: properties }),
          'Obstacles',
        )!
          .split('\n')
          .find((line) =>
            line.startsWith('| Ambulance Not In Familiar Area |'),
          )!
          .split(' | ')[4]!
          .replace(/ \|$/, '');
      assert.strictEqual(
        resolution({ ResolutionType: 'goal substitution' }),
        'goal substitution',
      );
      assert.strictEqual(
        resolution({
          Anchor: 'achieve_ambulance_on_scene_when_ambulance_mobilized',
        }),
        'unspecified, anchored on Achieve [Ambulance On Scene When Ambulance Mobilized]',
      );
      assert.strictEqual(resolution({}), '');
      // #187: invalid value (was 'bogus, anchored on nowhere'); #243: changed
      // (was 'unspecified, anchored on nowhere'): an anchor naming no element
      // is unset, so is the type: nothing to write
      assert.strictEqual(
        resolution({ ResolutionType: 'bogus', Anchor: 'nowhere' }),
        '',
      );
      // #243: changed (was 'mitigation, anchored on GPS Not Working'): an
      // anchor on an obstacle, not a goal, is unset
      assert.strictEqual(
        resolution({ ResolutionType: 'mitigation', Anchor: 'gps_not_working' }),
        'mitigation',
      );
    });

    it('an anchor by the id a goal’s text starts with', () => {
      const text = JSON.parse(
        withProperties(LAS, { [RESOLUTION]: { Anchor: 'G7' } }),
      );
      const goal = text.orphans.find(
        (e: { id: string }) =>
          e.id === 'achieve_ambulance_on_scene_when_ambulance_mobilized',
      );
      goal.text = `G7: ${goal.text}`;
      assert.ok(
        sectionOf(JSON.stringify(text), 'Obstacles')!.includes(
          '| unspecified, anchored on G7: Achieve [Ambulance On Scene When Ambulance Mobilized] |',
        ),
      );
    });
  });

  describe('elements the mapper does not map', () => {
    it('a refinement hub keeps its properties as written, a value outside its vocabulary too', () => {
      const text = withProperties(SEED, {
        [HUB]: { Tactic: ' case-driven ', Status: '', SysRef: 'S1' },
      });
      assert.deepStrictEqual(elementProperties(text, HUB), {
        Tactic: ' case-driven ',
        Status: '',
        SysRef: 'S1',
      });
      assert.ok(
        sectionOf(text, 'Refinements')!.includes(
          '| Maintain [Minimal Interval Between Automatic Backups] | Internet connection available |  | case-driven |  | S1 |',
        ),
      );
      // #187: invalid value
      assert.ok(
        sectionOf(
          withProperties(SEED, { [HUB]: { Tactic: 'by cases' } }),
          'Refinements',
        )!.includes('| by cases |'),
      );
    });

    it('an agent is no goal node; its element keeps its properties as written', () => {
      const text = withProperties(SEED, {
        [AGENT]: { Description: ' a person ', Type: 'x' },
      });
      assert.deepStrictEqual(elementProperties(text, AGENT), {
        Description: ' a person ',
        Type: 'x',
      });
      assert.throws(() => nodeEngine(text, AGENT), {
        message: `${AGENT} is no goal node`,
      });
    });
  });
});
