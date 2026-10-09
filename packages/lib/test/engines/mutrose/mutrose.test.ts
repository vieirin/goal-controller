import * as assert from 'assert';
import { describe, it } from 'mocha';
import { GoalTree, Model, type IStarModel } from '@goal-controller/goal-tree';
import {
  mutroseCheckRegistry,
  mutroseEngineMapper,
  mutroseRuntimeAnnotation,
  type MutroseGoalNode,
} from '../../../src/engines/mutrose';

const EXAMPLE = '../../examples/mutrose/MedicineDelivery.txt';

/** The example, with some elements' properties changed (by id, `undefined` removes one). */
const edited = (
  changes: Record<string, Record<string, string | undefined>> = {},
  file = EXAMPLE,
): IStarModel => {
  const model = Model.load(file);
  const elements = new Map(model.elements);
  for (const [id, change] of Object.entries(changes)) {
    const element = [...elements.values()].find((e) =>
      e.name.startsWith(`${id}:`),
    );
    if (!element) throw new Error(`${id} not found`);
    const properties: Record<string, string> = { ...element.customProperties };
    for (const [key, value] of Object.entries(change))
      if (value === undefined) delete properties[key];
      else properties[key] = value;
    elements.set(element.id, { ...element, customProperties: properties });
  }
  return { ...model, elements };
};

const treeOf = (model: IStarModel) =>
  GoalTree.fromModel(model, mutroseEngineMapper);
const annotation = (model: IStarModel) =>
  mutroseRuntimeAnnotation(treeOf(model).nodes);
const problem = (model: IStarModel) => {
  try {
    annotation(model);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
};

describe('mutroseEngineMapper', () => {
  it('reads goals and abstract tasks as the decomposer does', () => {
    const tree = treeOf(edited());
    const goal = (id: string) =>
      GoalTree.allByType(tree.nodes, 'goal').find((g) => g.id === id)!
        .properties.engine;
    const task = (id: string) =>
      GoalTree.allByType(tree.nodes, 'task').find((t) => t.id === id)!
        .properties.engine;
    assert.deepStrictEqual(goal('G3').achieveCondition, {
      forAll: {
        iterated: 'requests',
        iteration: 'current_request',
        condition: ' current_request.served',
      },
      text: 'requests->forAll(current_request | current_request.served)',
    });
    assert.deepStrictEqual(goal('G2').controls, [
      { name: 'requests', type: 'Sequence(Request)' },
    ]);
    assert.deepStrictEqual(goal('G2').queriedProperty, {
      source: 'world_db',
      variable: 'r',
      type: 'Request',
      condition: 'r.pending = True',
    });
    assert.strictEqual(goal('G3').group, false);
    assert.strictEqual(goal('G1').goalType, 'Perform');
    assert.deepStrictEqual(task('AT1'), { location: 'room', params: ['room'] });
    assert.deepStrictEqual(task('AT3'), {
      params: ['current_request'],
      robotNumber: 1,
    });
  });

  it('takes a Query goal without children (a leaf)', () => {
    const g2 = GoalTree.allByType(treeOf(edited()).nodes, 'goal').find(
      (g) => g.id === 'G2',
    ) as MutroseGoalNode;
    assert.deepStrictEqual([g2.children, g2.tasks], [[], undefined]);
  });

  it('stops at the first value a check rejects, naming the element', () => {
    assert.throws(
      () => treeOf(edited({ AT3: { RobotNumber: '[1, 2]' } })),
      /^Error: Invalid declaration of robot number: \[1, 2\] \(node AT3\)$/,
    );
  });
});

describe('mutroseRuntimeAnnotation', () => {
  it('prints the runtime annotation over the abstract tasks, as `-v` does', () => {
    assert.strictEqual(
      annotation(edited()),
      '(G2;NC(G4;NC(FALLBACK(NC(AT1;AT2),AT3))))\n',
    );
  });

  it('runs a goal without an annotation in parallel; one child is a means-end', () => {
    const model = edited();
    const elements = new Map(model.elements);
    for (const [key, element] of elements)
      if (/^G[35]:/.test(element.name))
        elements.set(key, {
          ...element,
          name: element.name.replace(/ \[.*\]$/, ''),
        });
    assert.strictEqual(
      annotation({ ...model, elements }),
      '(G2;NC(G4#NC(AT1#AT2)#AT3))\n',
    );
  });

  it('reports what check_gm_validity reports, as it stops at the first', () => {
    assert.strictEqual(problem(edited()), null);
    assert.strictEqual(
      problem(edited({ G2: { Controls: undefined } })),
      'No controlled variable was declared for Query goal [G2]',
    );
    assert.strictEqual(
      problem(
        edited({
          G2: {
            GoalType: 'Perform',
            QueriedProperty: undefined,
            Controls: undefined,
          },
        }),
      ),
      'Undeclared variable [requests] of type [] in goal G3',
    );
    assert.strictEqual(
      problem(edited({ G4: { Controls: 'requests : Location' } })),
      'Redeclaration of variable [requests] in goal G4',
    );
    assert.strictEqual(
      problem(edited({ G3: { Monitors: undefined } })),
      "Did not find iterated variable requests in G3's controlled variables list",
    );
    assert.strictEqual(
      problem(edited({ G4: { Controls: 'room : Room' } })),
      'Query variable [l] type + [Location] is different than the base type of the first controlled variable [room] ([Room])',
    );
    assert.strictEqual(
      problem(edited({ AT2: { Params: 'patient' } })),
      'Could not find value for parameter [patient] for task [AT2]',
    );
  });

  it('reads the istar-ts editor’s LabSampleLogistics as the decomposer would: G2 is missing', () => {
    assert.strictEqual(
      problem(Model.load('../../examples/mutrose/LabSampleLogistics.txt')),
      'Undeclared variable [deliveries_requested] of type [] in goal G3',
    );
  });
});

describe('mutroseCheckRegistry', () => {
  const check = (
    name: keyof typeof mutroseCheckRegistry,
    raw: Record<string, string>,
  ) => mutroseCheckRegistry[name](raw, { self: 'G1', kindOf: () => undefined });

  it('rejects what the decomposer’s readers reject, with their messages', () => {
    assert.strictEqual(
      check('mutrose.goal.controls', { Controls: 'room : Location, : Room' }),
      'Invalid variable declaration  : Room in GM.',
    );
    assert.strictEqual(
      check('mutrose.goal.monitors', { Controls: ': bad', Monitors: 'room' }),
      null,
    );
    assert.strictEqual(
      check('mutrose.goal.achieveCondition', {
        AchieveCondition: 'rooms->forAll(r is_clean)',
      }),
      'Invalid forAll statement rooms->forAll(r is_clean) in GM.',
    );
    assert.strictEqual(
      check('mutrose.goal.achieveCondition', {
        AchieveCondition: 'r.is_clean',
      }),
      null,
    );
    assert.strictEqual(
      check('mutrose.goal.queriedProperty', {
        QueriedProperty: 'world_db->select(r | r.dirty)',
      }),
      'Invalid select statement world_db->select(r | r.dirty) in GM.',
    );
    assert.strictEqual(
      check('mutrose.task.robotNumber', { RobotNumber: '[1,3]' }),
      null,
    );
  });

  it('says what the decomposer reads where it would ignore the text', () => {
    assert.strictEqual(
      check('mutrose.goal.creationCondition', {
        CreationCondition: 'assertion trigger "DoorOpened"',
      }),
      null,
    );
    assert.match(
      check('mutrose.goal.creationCondition', {
        CreationCondition: 'when open',
      })!,
      /^A CreationCondition is assertion condition/,
    );
    assert.strictEqual(
      check('mutrose.task.params', { Params: 'room, ' }),
      'Params are variable names, comma-separated: not an empty name',
    );
    assert.strictEqual(
      check('mutrose.task.location', { Location: 'room, hall' }),
      'A Location is one variable name, not room, hall',
    );
  });
});
