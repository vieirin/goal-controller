/**
 * sleecEngineMapper, characterized (goal-controller#187 phase 2 pre-work):
 * what it produces today for every custom property it reads, and how it
 * fails, so the migration to typed values can show nothing changed. SLEEC
 * has no dialect definition of its own: every property is free text, read
 * as written (no trimming), so no value is one the dialect flags.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { GoalTree, Model, type IStarModel } from '@goal-controller/goal-tree';
import {
  sleecEngineMapper,
  sleecTemplateEngine,
  SLEEC_GOAL_KEYS,
  SLEEC_QUALITY_KEYS,
  SLEEC_TASK_KEYS,
} from '../../../src/engines/sleec';

const SEED = '../../examples/sleec/goalModel-sleec.txt';

/** The seed, the element whose name starts with `prefix` given these custom properties (and kind). */
const seedWith = (
  edits: Record<
    string,
    { customProperties: Record<string, string>; kind?: string }
  >,
): IStarModel => {
  const original = Model.load(SEED);
  const elements = new Map(original.elements);
  for (const [prefix, { customProperties, kind }] of Object.entries(edits)) {
    const element = [...elements.values()].find((e) =>
      e.name.startsWith(prefix),
    );
    if (!element) throw new Error(`${prefix} not found in the seed`);
    elements.set(element.id, {
      ...element,
      ...(kind && { kind: kind as typeof element.kind }),
      customProperties,
    });
  }
  return { ...original, elements };
};

const treeOf = (model: IStarModel) =>
  GoalTree.fromModel(model, sleecEngineMapper).nodes;

const goalEngine = (model: IStarModel, id: string) => {
  const goal = GoalTree.allByType(treeOf(model), 'goal').find(
    (node) => node.id === id,
  );
  if (!goal) throw new Error(`${id} not found in the tree`);
  return goal.properties.engine;
};

const taskEngine = (model: IStarModel, id: string) => {
  const task = GoalTree.allByType(treeOf(model), 'task').find(
    (node) => node.id === id,
  );
  if (!task) throw new Error(`${id} not found in the tree`);
  return task.properties.engine;
};

/** T1's four required properties, valid. */
const REQUIRED = {
  PreCond: '(not {purposeProtocolInformed})',
  TriggeringEvent: 'MeetingUser',
  TemporalConstraint: '120 seconds',
  PostCond: '{purposeProtocolInformed}',
};

describe('sleecEngineMapper: characterization (#187)', () => {
  it('reads these keys, and no others', () => {
    assert.deepStrictEqual(SLEEC_GOAL_KEYS, [
      'Type',
      'Source',
      'Class',
      'NormPrinciple',
      'Proxy',
      'AddedValue',
      'Condition',
      'Event',
      'ContextEvent',
    ]);
    assert.deepStrictEqual(SLEEC_TASK_KEYS, [
      'PreCond',
      'TriggeringEvent',
      'TemporalConstraint',
      'PostCond',
      'Obstacle',
    ]);
    assert.deepStrictEqual(SLEEC_QUALITY_KEYS, ['NormPrinciple', 'Proxy']);
  });

  describe('goal properties', () => {
    it('keeps every goal key set, as written: not trimmed', () => {
      const engine = goalEngine(
        seedWith({
          'G3:': {
            customProperties: {
              Type: ' Achieve ',
              Source: 'BSN',
              Class: 'legal',
              NormPrinciple: '  Autonomy',
              Proxy: 'Assent/Consent  ',
              AddedValue: '1',
              Condition: '(not {purposeProtocolInformed})',
              Event: 'StartInformPurposeandProtocol',
              ContextEvent: 'ObtainConsentFullTracking\n',
            },
          },
        }),
        'G3',
      );
      assert.deepStrictEqual(engine, {
        Type: ' Achieve ',
        Source: 'BSN',
        Class: 'legal',
        NormPrinciple: '  Autonomy',
        Proxy: 'Assent/Consent  ',
        AddedValue: '1',
        Condition: '(not {purposeProtocolInformed})',
        Event: 'StartInformPurposeandProtocol',
        ContextEvent: 'ObtainConsentFullTracking\n',
      });
    });

    it('leaves out a key empty, blank or absent, and keys it does not read', () => {
      const engine = goalEngine(
        seedWith({
          'G3:': {
            customProperties: {
              Type: '',
              Source: '   ',
              Class: '\n\t',
              Condition: 'x',
              Description: 'not read',
              selected: 'true',
              PreCond: 'a task key',
            },
          },
        }),
        'G3',
      );
      assert.deepStrictEqual(engine, { Condition: 'x' });
    });

    it('gives a goal with no properties an empty object', () => {
      assert.deepStrictEqual(
        goalEngine(seedWith({ 'G3:': { customProperties: {} } }), 'G3'),
        {},
      );
    });

    it('keeps a Type of any casing or word: the template reads only Achieve and Maintain', () => {
      for (const Type of ['achieve', 'MAINTAIN', 'Avoid', 'soft'])
        assert.deepStrictEqual(
          goalEngine(seedWith({ 'G3:': { customProperties: { Type } } }), 'G3'),
          { Type },
        );
    });

    it('purposes match Type exactly: a padded or lower-case one is no purpose', () => {
      const purposes = (Type: string) =>
        sleecTemplateEngine(
          treeOf(
            seedWith({
              'G3:': {
                customProperties: {
                  Type,
                  Condition: '{c}',
                  Event: 'E',
                  ContextEvent: 'CE',
                },
              },
            }),
          ),
        ).split('purpose_start\n')[1];
      assert.strictEqual(
        purposes('Achieve'),
        '  P1 when CE and {c} then E\npurpose_end',
      );
      assert.strictEqual(
        purposes('Maintain'),
        '  P1 exists E and {c} while CE\npurpose_end',
      );
      assert.strictEqual(purposes(' Achieve'), '  \npurpose_end');
      assert.strictEqual(purposes('achieve'), '  \npurpose_end');
    });

    it('a quality reads NormPrinciple and Proxy only, blank ones left out', () => {
      const engine = goalEngine(
        seedWith({
          'G3:': {
            kind: 'istar.Quality',
            customProperties: {
              NormPrinciple: ' Autonomy ',
              Proxy: '  ',
              Type: 'Achieve',
              Condition: 'x',
            },
          },
        }),
        'G3',
      );
      assert.deepStrictEqual(engine, { NormPrinciple: ' Autonomy ' });
    });
  });

  describe('task properties', () => {
    it('keeps the four required keys and Obstacle as written: not trimmed', () => {
      const engine = taskEngine(
        seedWith({
          'T1:': {
            customProperties: {
              PreCond: ' (not {purposeProtocolInformed}) ',
              TriggeringEvent: 'MeetingUser ',
              TemporalConstraint: ' 120 seconds',
              PostCond: '{purposeProtocolInformed}\n',
              Obstacle: ' ObtainConsentPartialTracking ',
            },
          },
        }),
        'T1',
      );
      assert.deepStrictEqual(engine, {
        PreCond: ' (not {purposeProtocolInformed}) ',
        TriggeringEvent: 'MeetingUser ',
        TemporalConstraint: ' 120 seconds',
        PostCond: '{purposeProtocolInformed}\n',
        Obstacle: ' ObtainConsentPartialTracking ',
      });
    });

    it('keeps a TemporalConstraint of any text: no number is read from it', () => {
      for (const TemporalConstraint of ['120', 'soon', '-1 seconds', '1e3 s'])
        assert.strictEqual(
          taskEngine(
            seedWith({
              'T1:': { customProperties: { ...REQUIRED, TemporalConstraint } },
            }),
            'T1',
          ).TemporalConstraint,
          TemporalConstraint,
        );
    });

    it('leaves out an empty Obstacle, but keeps a blank one (truthy, not trimmed)', () => {
      const obstacle = (Obstacle: string) =>
        taskEngine(
          seedWith({ 'T1:': { customProperties: { ...REQUIRED, Obstacle } } }),
          'T1',
        );
      assert.deepStrictEqual(obstacle(''), REQUIRED);
      assert.deepStrictEqual(obstacle('   '), { ...REQUIRED, Obstacle: '   ' });
    });

    it('a blank Obstacle still writes rule _5', () => {
      const rules = sleecTemplateEngine(
        treeOf(
          seedWith({
            'T1:': { customProperties: { ...REQUIRED, Obstacle: '   ' } },
          }),
        ),
      );
      assert.ok(
        rules.includes(
          'RuleT1_5 when PursuingInformSystemPurposeandProtocol and     then StopInformSystemPurposeandProtocol',
        ),
      );
    });

    it('reads Obstacle, not the ObstacleEvent or FluentName the seed writes', () => {
      assert.deepStrictEqual(
        taskEngine(
          seedWith({
            'T1:': {
              customProperties: {
                ...REQUIRED,
                ObstacleEvent: 'AchievedObtainConsentPartialTracking',
                FluentName: 'InformPurposeAndProtocol',
                Description: 'not read',
                Type: 'a goal key',
              },
            },
          }),
          'T1',
        ),
        REQUIRED,
      );
      // the seed's T6 has an ObstacleEvent: the tree has no Obstacle for it
      assert.deepStrictEqual(taskEngine(Model.load(SEED), 'T6'), {
        PreCond:
          '(({userConsentsFullVitalsTracking} and (not {patientIsHome}))',
        TriggeringEvent: 'PatientOutdoors',
        TemporalConstraint: '300 seconds',
        PostCond: '{dataCollected}',
      });
    });

    it('throws for a task missing a required key, naming it', () => {
      const { PreCond: _, ...withoutPreCond } = REQUIRED;
      assert.throws(
        () => treeOf(seedWith({ 'T1:': { customProperties: withoutPreCond } })),
        {
          message:
            'Task "Inform System Purpose and Protocol" is missing required SLEEC properties: PreCond. All tasks must define: PreCond, TriggeringEvent, PostCond, TemporalConstraint.',
        },
      );
    });

    it('counts an empty or blank required key as missing, listing them in its order', () => {
      assert.throws(
        () =>
          treeOf(
            seedWith({
              'T1:': {
                customProperties: {
                  PreCond: 'x',
                  TriggeringEvent: '',
                  TemporalConstraint: '  ',
                  PostCond: '\t',
                },
              },
            }),
          ),
        {
          message:
            'Task "Inform System Purpose and Protocol" is missing required SLEEC properties: TriggeringEvent, PostCond, TemporalConstraint. All tasks must define: PreCond, TriggeringEvent, PostCond, TemporalConstraint.',
        },
      );
    });

    it('throws for a task with none of them, all four listed', () => {
      assert.throws(
        () => treeOf(seedWith({ 'T1:': { customProperties: {} } })),
        {
          message:
            'Task "Inform System Purpose and Protocol" is missing required SLEEC properties: PreCond, TriggeringEvent, PostCond, TemporalConstraint. All tasks must define: PreCond, TriggeringEvent, PostCond, TemporalConstraint.',
        },
      );
    });
  });
});
