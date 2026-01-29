import * as assert from 'assert';
import { describe, it } from 'mocha';
import { generatePurposes } from '../../../../src/engines/sleec/template/purposes';
import type {
  SleecGoalNode,
  SleecGoalTree,
} from '../../../../src/engines/sleec/mapper';
import type { SleecGoalProps } from '../../../../src/engines/sleec/types';

/**
 * Helper to create a minimal GoalNode with sleec props
 */
const createGoalNode = (
  id: string,
  name: string,
  sleec?: SleecGoalProps,
): SleecGoalNode =>
  ({
    id,
    name,
    type: 'goal',
    properties: {
      engine: sleec,
    },
    resources: [],
  }) as unknown as SleecGoalNode;

describe('sleecTemplateEngine', () => {
  describe('generatePurposes', () => {
    it('should generate purpose for Achieve type goal', () => {
      const tree: SleecGoalTree = [
        createGoalNode('G1', 'VitalSignsConsent', {
          Type: 'Achieve',
          Condition: '(not {purposeProtocolInformed})',
          Event: 'StartInformPurposeandProtocol',
          ContextEvent: 'ObtainConsentFullTracking',
        }),
      ];

      const purposes = generatePurposes(tree);

      assert.ok(purposes.includes('purpose_start'));
      assert.ok(purposes.includes('purpose_end'));
      assert.ok(
        purposes.includes(
          'P1 when ObtainConsentFullTracking and (not {purposeProtocolInformed}) then StartInformPurposeandProtocol',
        ),
      );
    });

    it('should generate purpose for Maintain type goal', () => {
      const tree: SleecGoalTree = [
        createGoalNode('G1', 'PatientMonitoring', {
          Type: 'Maintain',
          Condition: '{patientAwake}',
          Event: 'MonitorVitals',
          ContextEvent: 'PatientInRoom',
        }),
      ];

      const purposes = generatePurposes(tree);

      assert.ok(purposes.includes('purpose_start'));
      assert.ok(purposes.includes('purpose_end'));
      assert.ok(
        purposes.includes(
          'P1 exists MonitorVitals and {patientAwake} while PatientInRoom',
        ),
      );
    });

    it('should skip goals without Achieve or Maintain type', () => {
      const tree: SleecGoalTree = [
        createGoalNode('G1', 'RegularGoal', {
          Type: 'Other',
          Condition: 'condition',
          Event: 'event',
          ContextEvent: 'contextEvent',
        }),
        createGoalNode('G2', 'NoTypeGoal', undefined),
      ];

      const purposes = generatePurposes(tree);

      assert.strictEqual(purposes, 'purpose_start\n  \npurpose_end');
    });

    it('should generate sequential purpose labels P1, P2, P3', () => {
      const tree: SleecGoalTree = [
        createGoalNode('G1', 'Goal1', {
          Type: 'Achieve',
          Condition: 'cond1',
          Event: 'event1',
          ContextEvent: 'ctx1',
        }),
        createGoalNode('G2', 'Goal2', {
          Type: 'Achieve',
          Condition: 'cond2',
          Event: 'event2',
          ContextEvent: 'ctx2',
        }),
        createGoalNode('G3', 'Goal3', {
          Type: 'Maintain',
          Condition: 'cond3',
          Event: 'event3',
          ContextEvent: 'ctx3',
        }),
      ];

      const purposes = generatePurposes(tree);

      assert.ok(purposes.includes('P1 when ctx1'));
      assert.ok(purposes.includes('P2 when ctx2'));
      assert.ok(purposes.includes('P3 exists event3'));
    });

    it('should throw error when Condition is missing', () => {
      const tree: SleecGoalTree = [
        createGoalNode('G1', 'MissingCondition', {
          Type: 'Achieve',
          Event: 'event',
          ContextEvent: 'contextEvent',
        }),
      ];

      assert.throws(
        () => generatePurposes(tree),
        /Purpose MissingCondition has no condition, event or contextEvent property/,
      );
    });

    it('should throw error when Event is missing', () => {
      const tree: SleecGoalTree = [
        createGoalNode('G1', 'MissingEvent', {
          Type: 'Achieve',
          Condition: 'condition',
          ContextEvent: 'contextEvent',
        }),
      ];

      assert.throws(
        () => generatePurposes(tree),
        /Purpose MissingEvent has no condition, event or contextEvent property/,
      );
    });

    it('should throw error when ContextEvent is missing', () => {
      const tree: SleecGoalTree = [
        createGoalNode('G1', 'MissingContextEvent', {
          Type: 'Achieve',
          Condition: 'condition',
          Event: 'event',
        }),
      ];

      assert.throws(
        () => generatePurposes(tree),
        /Purpose MissingContextEvent has no condition, event or contextEvent property/,
      );
    });

    it('should handle nested goals in tree', () => {
      const childGoal = createGoalNode('G2', 'ChildGoal', {
        Type: 'Achieve',
        Condition: 'childCond',
        Event: 'childEvent',
        ContextEvent: 'childCtx',
      });

      const parentGoal = createGoalNode('G1', 'ParentGoal', {
        Type: 'Achieve',
        Condition: 'parentCond',
        Event: 'parentEvent',
        ContextEvent: 'parentCtx',
      });
      parentGoal.children = [childGoal];

      const tree: SleecGoalTree = [parentGoal];

      const purposes = generatePurposes(tree);

      // allByType should find both parent and child goals
      assert.ok(purposes.includes('P1 when parentCtx'));
      assert.ok(purposes.includes('P2 when childCtx'));
    });

    it('should return empty purposes section when no applicable goals', () => {
      const tree: SleecGoalTree = [
        createGoalNode('G1', 'TaskGoal', undefined),
        createGoalNode('G2', 'AnotherGoal', { Type: 'Unknown' }),
      ];

      const purposes = generatePurposes(tree);

      assert.strictEqual(purposes, 'purpose_start\n  \npurpose_end');
    });

    it('should match BSN Goal Model format', () => {
      // Based on goalModel-sleec2.txt G6: VitalSignsConsent
      const tree: SleecGoalTree = [
        createGoalNode('G6', 'VitalSignsConsent', {
          Type: 'Achieve',
          Source:
            'Healthcare and data-protection regulations (e.g., GDPR);medical ethics',
          Class: 'Ethical; Legal; Social',
          NormPrinciple: 'Autonomy; Privacy',
          Proxy: 'ConsentStatus ∈ {Full, Partial, Withdrawn}',
          AddedValue:
            'Preserved patient autonomy and reduced privacy intrusion',
          Condition: '(not {purposeProtocolInformed})',
          Event: 'StartInformPurposeandProtocol',
          ContextEvent: 'ObtainConsentFullTracking',
        }),
      ];

      const purposes = generatePurposes(tree);

      assert.ok(purposes.startsWith('purpose_start'));
      assert.ok(purposes.endsWith('purpose_end'));
      assert.ok(
        purposes.includes(
          'P1 when ObtainConsentFullTracking and (not {purposeProtocolInformed}) then StartInformPurposeandProtocol',
        ),
      );
    });
  });
});
