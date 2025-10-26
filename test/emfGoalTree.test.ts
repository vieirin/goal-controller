// @ts-nocheck
/**
 * EMF Goal Tree vs Old IR Comparison Tests
 *
 * This test file compares the structure of the new EMF-based goal tree representation
 * with the old intermediate representation (IR) GoalTreeWithParent to ensure they
 * maintain structural compatibility.
 *
 * Test Coverage:
 * - Basic Structure: Root node existence, IDs, names, and types
 * - Tree Traversal: Node counts and ID matching across the tree
 * - Goal Properties: Goal types (Achieve/Maintain), utility, cost, and conditions
 * - Parent-Child Relationships: Child counts and IDs for each goal
 * - Execution Details: Runtime operators (Interleaved, Alternative, Any)
 * - Resources: Resource attachment to tasks
 * - Dependencies: Goal dependencies matching
 *
 * Note: @ts-nocheck is used due to pre-existing TypeScript errors in the EMF model files.
 *       These errors are not related to this test file.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { convertModelToEMF } from '../src/GoalTree/index';
import { convertToTree } from '../src/ObjectiveTree/creation';
import { loadModel } from '../src/ObjectiveTree/index';
import {
  GoalNodeWithParent,
  GoalTreeWithParent,
} from '../src/ObjectiveTree/types';
import { GoalTree } from '../src/edgeEMFModel/GoalTree';
import { Goal } from '../src/edgeEMFModel/Goal';
import { Task } from '../src/edgeEMFModel/Task';
import { Node as EMFNode } from '../src/edgeEMFModel/Node';
import { GoalImpl } from '../src/edgeEMFModel/GoalImpl';
import { TaskImpl } from '../src/edgeEMFModel/TaskImpl';
import { GoalType } from '../src/edgeEMFModel/GoalType';
import { RuntimeOp } from '../src/edgeEMFModel/RuntimeOp';

// Helper type to work around TypeScript import issues with EMF types
type GoalWithId = Goal & { id: string; name: string };
type TaskWithId = Task & { id: string; name: string };

describe('EMF Goal Tree vs Old IR Comparison', () => {
  const testFile = 'examples/labSamplesWithSideEffect.txt';
  let model: ReturnType<typeof loadModel>;
  let emfTree: GoalTree;
  let oldIRTree: GoalTreeWithParent;

  before(() => {
    // Load the model
    model = loadModel({ filename: testFile });

    // Convert to EMF
    emfTree = convertModelToEMF(model);

    // Convert to old IR
    oldIRTree = convertToTree({ model });
  });

  describe('Basic Structure', () => {
    it('should have a root node in both representations', () => {
      assert.ok(emfTree.root, 'EMF tree should have a root');
      assert.ok(
        oldIRTree.length > 0,
        'Old IR tree should have at least one node'
      );
      assert.strictEqual(
        oldIRTree.length,
        1,
        'Old IR tree should have exactly one root'
      );
    });

    it('should have matching root IDs', () => {
      const emfRootId = emfTree.root?.id;
      const oldIRRootId = oldIRTree[0]?.id;

      assert.strictEqual(emfRootId, oldIRRootId, 'Root IDs should match');
    });

    it('should have matching root names', () => {
      const emfRootName = emfTree.root?.name;
      const oldIRRootName = oldIRTree[0]?.name;

      assert.strictEqual(emfRootName, oldIRRootName, 'Root names should match');
    });

    it('should have matching root types', () => {
      const emfRoot = emfTree.root;
      const oldIRRoot = oldIRTree[0];

      assert.ok(
        emfRoot instanceof GoalImpl || emfRoot instanceof TaskImpl,
        'EMF root should be Goal or Task'
      );
      assert.ok(
        oldIRRoot?.type === 'goal' || oldIRRoot?.type === 'task',
        'Old IR root should be goal or task'
      );
    });
  });

  // Helper functions  
  const collectEMFNodes = (node: any): any[] => {
    if (!node) return [];
    const nodes: any[] = [node];
    
    if (node.child?.outgoing) {
      const children = node.child.outgoing;
      for (let i = 0; i < children.size(); i++) {
        const child = children.at(i);
        nodes.push(...collectEMFNodes(child));
      }
    }
    
    return nodes;
  };

  const collectOldIRNodes = (
    node: GoalNodeWithParent
  ): GoalNodeWithParent[] => {
    const nodes: GoalNodeWithParent[] = [node];

    if (node.children) {
      for (const child of node.children) {
        nodes.push(...collectOldIRNodes(child));
      }
    }

    return nodes;
  };

  const findOldIRGoalById = (
    id: string,
    nodes: GoalNodeWithParent[]
  ): GoalNodeWithParent | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findOldIRGoalById(id, node.children);
        if (found) return found;
      }
    }
    return undefined;
  };

  describe('Tree Traversal and Node Count', () => {
    it('should have the same number of goal nodes', () => {
      const emfNodes = collectEMFNodes(emfTree.root as EMFNode);
      const emfGoals = emfNodes.filter((n) => n instanceof GoalImpl);

      const oldIRNodes = oldIRTree.flatMap(collectOldIRNodes);
      const oldIRGoals = oldIRNodes.filter((n) => n.type === 'goal');

      assert.strictEqual(
        emfGoals.length,
        oldIRGoals.length,
        `Number of goals should match (EMF: ${emfGoals.length}, Old IR: ${oldIRGoals.length})`
      );
    });

    it('should have matching goal IDs throughout the tree', () => {
      const emfNodes = collectEMFNodes(emfTree.root as EMFNode);
      const emfGoalIds = emfNodes
        .filter((n) => n instanceof GoalImpl)
        .map((n) => (n as unknown as GoalWithId).id)
        .sort();

      const oldIRNodes = oldIRTree.flatMap(collectOldIRNodes);
      const oldIRGoalIds = oldIRNodes
        .filter((n) => n.type === 'goal')
        .map((n) => n.id)
        .sort();

      assert.deepStrictEqual(emfGoalIds, oldIRGoalIds, 'Goal IDs should match');
    });
  });

  describe('Goal Properties', () => {
    const findEMFGoalById = (id: string, node: any): GoalWithId | undefined => {
      if (!node) return undefined;
      if (
        node instanceof GoalImpl &&
        (node as unknown as GoalWithId).id === id
      ) {
        return node as unknown as GoalWithId;
      }

      if (node.child?.outgoing) {
        const children = node.child.outgoing;
        for (let i = 0; i < children.size(); i++) {
          const child = children.at(i);
          const found = findEMFGoalById(id, child);
          if (found) return found;
        }
      }

      return undefined;
    };

    it('should have matching goal types (Achieve vs Maintain)', () => {
      const emfNodes = collectEMFNodes(emfTree.root as EMFNode);
      const emfGoals = emfNodes
        .filter((n) => n instanceof GoalImpl)
        .map((n) => n as unknown as GoalWithId);

      for (const emfGoal of emfGoals) {
        const oldIRGoal = findOldIRGoalById(emfGoal.id, oldIRTree);
        assert.ok(oldIRGoal, `Old IR should have goal ${emfGoal.id}`);

        if (emfGoal.type === GoalType.MAINTAIN) {
          assert.strictEqual(
            oldIRGoal?.customProperties?.type,
            'maintain',
            `Goal ${emfGoal.id} should be maintain in both representations`
          );
        } else {
          assert.notStrictEqual(
            oldIRGoal?.customProperties?.type,
            'maintain',
            `Goal ${emfGoal.id} should be achieve in both representations`
          );
        }
      }
    });

    it('should have matching utility and cost values', () => {
      const emfNodes = collectEMFNodes(emfTree.root as EMFNode);
      const emfGoals = emfNodes
        .filter((n) => n instanceof GoalImpl)
        .map((n) => n as unknown as GoalWithId);

      for (const emfGoal of emfGoals) {
        const oldIRGoal = findOldIRGoalById(emfGoal.id, oldIRTree);
        assert.ok(oldIRGoal, `Old IR should have goal ${emfGoal.id}`);

        const oldIRUtility = parseFloat(
          oldIRGoal?.customProperties?.utility || '0'
        );
        const oldIRCost = parseFloat(oldIRGoal?.customProperties?.cost || '0');

        assert.strictEqual(
          emfGoal.utility,
          oldIRUtility,
          `Goal ${emfGoal.id} utility should match`
        );
        assert.strictEqual(
          emfGoal.cost,
          oldIRCost,
          `Goal ${emfGoal.id} cost should match`
        );
      }
    });

    it('should have matching context/assertion conditions', () => {
      const emfNodes = collectEMFNodes(emfTree.root as EMFNode);
      const emfGoals = emfNodes
        .filter((n) => n instanceof GoalImpl)
        .map((n) => n as unknown as GoalWithId);

      for (const emfGoal of emfGoals) {
        const oldIRGoal = findOldIRGoalById(emfGoal.id, oldIRTree);
        assert.ok(oldIRGoal, `Old IR should have goal ${emfGoal.id}`);

        if (emfGoal.context) {
          assert.ok(
            oldIRGoal?.execCondition?.assertion,
            `Goal ${emfGoal.id} should have assertion in old IR`
          );
          assert.strictEqual(
            emfGoal.context.expression,
            oldIRGoal?.execCondition?.assertion?.sentence,
            `Goal ${emfGoal.id} assertion should match`
          );
        }
      }
    });

    it('should have matching maintain conditions for maintain goals', () => {
      const emfNodes = collectEMFNodes(emfTree.root as EMFNode);
      const emfGoals = emfNodes
        .filter((n) => n instanceof GoalImpl)
        .map((n) => n as unknown as GoalWithId);

      const maintainGoals = emfGoals.filter(
        (g) => g.type === GoalType.MAINTAIN
      );

      for (const emfGoal of maintainGoals) {
        const oldIRGoal = findOldIRGoalById(emfGoal.id, oldIRTree);
        assert.ok(oldIRGoal, `Old IR should have maintain goal ${emfGoal.id}`);

        if (emfGoal.maintainCondition) {
          assert.ok(
            oldIRGoal?.execCondition?.maintain,
            `Maintain goal ${emfGoal.id} should have maintain condition in old IR`
          );
          assert.strictEqual(
            emfGoal.maintainCondition.expression,
            oldIRGoal?.execCondition?.maintain?.sentence,
            `Maintain goal ${emfGoal.id} maintain condition should match`
          );
        }
      }
    });
  });

  describe('Parent-Child Relationships', () => {
    const getEMFChildren = (node: any): any[] => {
      if (!node.child?.outgoing) return [];
      const children = node.child.outgoing;
      const result: any[] = [];
      for (let i = 0; i < children.size(); i++) {
        result.push(children.at(i));
      }
      return result;
    };

    it('should have matching child counts for each goal', () => {
      const emfNodes = collectEMFNodes(emfTree.root as EMFNode);
      const emfGoals = emfNodes
        .filter((n) => n instanceof GoalImpl)
        .map((n) => n as unknown as GoalWithId);

      for (const emfGoal of emfGoals) {
        const emfChildren = getEMFChildren(
          emfGoal as unknown as EMFNode
        ).filter((c) => c instanceof GoalImpl);

        const oldIRGoal = findOldIRGoalById(emfGoal.id, oldIRTree);
        const oldIRChildren =
          oldIRGoal?.children?.filter((c) => c.type === 'goal') || [];

        assert.strictEqual(
          emfChildren.length,
          oldIRChildren.length,
          `Goal ${emfGoal.id} should have same number of children (EMF: ${emfChildren.length}, Old IR: ${oldIRChildren.length})`
        );
      }
    });

    it('should have matching child IDs for each goal', () => {
      const emfNodes = collectEMFNodes(emfTree.root as EMFNode);
      const emfGoals = emfNodes
        .filter((n) => n instanceof GoalImpl)
        .map((n) => n as unknown as GoalWithId);

      for (const emfGoal of emfGoals) {
        const emfChildren = getEMFChildren(emfGoal as unknown as EMFNode)
          .filter((c) => c instanceof GoalImpl)
          .map((c) => (c as unknown as GoalWithId).id)
          .sort();

        const oldIRGoal = findOldIRGoalById(emfGoal.id, oldIRTree);
        const oldIRChildren = (
          oldIRGoal?.children?.filter((c) => c.type === 'goal') || []
        )
          .map((c) => c.id)
          .sort();

        assert.deepStrictEqual(
          emfChildren,
          oldIRChildren,
          `Goal ${emfGoal.id} should have matching child IDs`
        );
      }
    });
  });

  describe('Execution Details', () => {
    it('should have matching execution operators', () => {
      const emfNodes = collectEMFNodes(emfTree.root as EMFNode);
      const emfGoals = emfNodes
        .filter((n) => n instanceof GoalImpl)
        .map((n) => n as unknown as GoalWithId);

      for (const emfGoal of emfGoals) {
        if (!emfGoal.exec) continue;

        const oldIRGoal = findOldIRGoalById(emfGoal.id, oldIRTree);
        assert.ok(oldIRGoal, `Old IR should have goal ${emfGoal.id}`);

        const emfOperator = emfGoal.exec.operator;
        const oldIRExecDetail = oldIRGoal?.executionDetail;

        if (emfOperator === RuntimeOp.INTERLEAVED) {
          assert.strictEqual(
            oldIRExecDetail?.type,
            'interleaved',
            `Goal ${emfGoal.id} should have interleaved execution`
          );
        } else if (emfOperator === RuntimeOp.ALTERNATIVE) {
          assert.ok(
            oldIRExecDetail?.type === 'alternative' ||
              oldIRExecDetail?.type === 'degradation',
            `Goal ${emfGoal.id} should have alternative or degradation execution`
          );
        } else if (emfOperator === RuntimeOp.ANY) {
          assert.strictEqual(
            oldIRExecDetail?.type,
            'choice',
            `Goal ${emfGoal.id} should have choice execution`
          );
        }
      }
    });
  });

  describe('Resources', () => {
    const collectEMFTasks = (node: any): TaskWithId[] => {
      if (!node) return [];
      const tasks: TaskWithId[] = [];

      if (node instanceof TaskImpl) {
        tasks.push(node as unknown as TaskWithId);
      }

      if (node?.child?.outgoing) {
        const children = node.child.outgoing;
        for (let i = 0; i < children.size(); i++) {
          const child = children.at(i);
          tasks.push(...collectEMFTasks(child));
        }
      }

      return tasks;
    };

    it('should have resources attached to tasks', () => {
      const emfTasks = collectEMFTasks(emfTree.root);

      for (const emfTask of emfTasks) {
        const oldIRNodes = oldIRTree.flatMap(collectOldIRNodes);
        const oldIRTask = oldIRNodes.find(
          (n) => n.id === emfTask.id && n.type === 'task'
        );

        if (oldIRTask) {
          const emfResourceCount = (emfTask as any).resources.size();
          const oldIRResourceCount = oldIRTask.resources?.length || 0;

          assert.strictEqual(
            emfResourceCount,
            oldIRResourceCount,
            `Task ${emfTask.id} should have same number of resources`
          );
        }
      }
    });
  });

  describe('Dependencies', () => {
    it('should have matching dependencies', () => {
      const emfNodes = collectEMFNodes(emfTree.root as EMFNode);
      const emfGoals = emfNodes
        .filter((n) => n instanceof GoalImpl)
        .map((n) => n as unknown as GoalWithId);

      for (const emfGoal of emfGoals) {
        const deps = (emfGoal as any).dependsOn;
        const emfDependencies: string[] = [];
        if (deps && deps.size) {
          for (let i = 0; i < deps.size(); i++) {
            emfDependencies.push(deps.at(i).id);
          }
        }
        emfDependencies.sort();

        const oldIRGoal = findOldIRGoalById(emfGoal.id, oldIRTree);
        const oldIRDependencies = (
          oldIRGoal?.customProperties?.dependsOn || []
        ).sort();

        assert.deepStrictEqual(
          emfDependencies,
          oldIRDependencies,
          `Goal ${emfGoal.id} should have matching dependencies`
        );
      }
    });
  });
});
