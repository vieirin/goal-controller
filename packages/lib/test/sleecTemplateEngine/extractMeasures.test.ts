import * as assert from 'assert';
import { describe, it } from 'mocha';
import { extractMeasures, Measure } from '../../src/sleecTemplateEngine/index';
import type { Task } from '@goal-controller/goal-tree';

/**
 * Helper to create a minimal Task node with only the properties needed for testing
 */
const createTaskNode = (
  id: string,
  preCond?: string,
  postCond?: string,
): Task =>
  ({
    id,
    type: 'task',
    properties: {
      sleec: {
        PreCond: preCond,
        PostCond: postCond,
      },
    },
  }) as Task;

describe('sleecTemplateEngine', () => {
  describe('extractMeasures', () => {
    /**
     * Test cases based on BSN-Goal-Model_v0.4l.sleec rules (lines 67-99)
     *
     * Boolean measures (used without = comparison):
     * - purposeProtocolInformed: (not {purposeProtocolInformed}), {purposeProtocolInformed}
     * - userConsentsFullVitalsTracking: {userConsentsFullVitalsTracking}
     * - userConsentsPartialVitalsTracking: {userConsentsPartialVitalsTracking}
     * - patientCanModifyOrRevokeAuthorizations: {patientCanModifyOrRevokeAuthorizations}
     * - profileAdapted: {profileAdapted}
     * - vitalSignsCollected: {vitalSignsCollected}
     * - patientIsHome: (not {patientIsHome})
     * - dataProcessed: {dataProcessed}
     * - dataAnalyzed: {dataAnalyzed}
     *
     * Scale measures (used with = value):
     * - riskLevel: ({riskLevel} = low)
     * - patientDiscomfort: ({patientDiscomfort} = low), ({patientDiscomfort} = moderate), ({patientDiscomfort} = high)
     */

    it('should extract boolean measure from simple condition: {purposeProtocolInformed}', () => {
      // RuleT1_1: (not {purposeProtocolInformed})
      // RuleT2_1: {purposeProtocolInformed}
      const tasks = [
        createTaskNode(
          'T1',
          '(not {purposeProtocolInformed})',
          '{purposeProtocolInformed}',
        ),
      ];

      const measures = extractMeasures(tasks);

      assert.deepStrictEqual(measures, [
        { name: 'purposeProtocolInformed', type: 'boolean' },
      ]);
    });

    it('should extract scale measure when used with = value: {riskLevel} = low', () => {
      // RuleT3_1: ({patientCanModifyOrRevokeAuthorizations} and ({riskLevel} = low))
      const tasks = [
        createTaskNode(
          'T3',
          '({patientCanModifyOrRevokeAuthorizations} and ({riskLevel} = low))',
          '{userConsentsPartialVitalsTracking}',
        ),
      ];

      const measures = extractMeasures(tasks);

      const riskLevel = measures.find((m) => m.name === 'riskLevel');
      assert.ok(riskLevel, 'riskLevel should be found');
      assert.strictEqual(
        riskLevel.type,
        'scale',
        'riskLevel should be scale type',
      );
      assert.deepStrictEqual(
        riskLevel.scaleValues,
        ['low'],
        'riskLevel should have scaleValues: ["low"]',
      );

      assert.ok(
        measures.find(
          (m) =>
            m.name === 'patientCanModifyOrRevokeAuthorizations' &&
            m.type === 'boolean',
        ),
        'patientCanModifyOrRevokeAuthorizations should be detected as boolean',
      );
    });

    it('should extract scale measure from multiple scale comparisons: {patientDiscomfort}', () => {
      // RuleT5_1: ((({patientDiscomfort} = low) or ({patientDiscomfort} = moderate)) or ({patientDiscomfort} = high))
      const tasks = [
        createTaskNode(
          'T5',
          '((({patientDiscomfort} = low) or ({patientDiscomfort} = moderate)) or ({patientDiscomfort} = high))',
          '{vitalSignsCollected}',
        ),
      ];

      const measures = extractMeasures(tasks);

      const patientDiscomfort = measures.find(
        (m) => m.name === 'patientDiscomfort',
      );
      assert.ok(patientDiscomfort, 'patientDiscomfort should be found');
      assert.strictEqual(
        patientDiscomfort.type,
        'scale',
        'patientDiscomfort should be scale type',
      );
      assert.deepStrictEqual(
        patientDiscomfort.scaleValues,
        ['low', 'moderate', 'high'],
        'patientDiscomfort should have semantically ordered scaleValues',
      );

      assert.ok(
        measures.find(
          (m) => m.name === 'vitalSignsCollected' && m.type === 'boolean',
        ),
        'vitalSignsCollected should be detected as boolean',
      );
    });

    it('should extract boolean measure from negation: (not {patientIsHome})', () => {
      // RuleT6_1: ({userConsentsFullVitalsTracking} and (not {patientIsHome}))
      const tasks = [
        createTaskNode(
          'T6',
          '({userConsentsFullVitalsTracking} and (not {patientIsHome}))',
          '{vitalSignsCollected}',
        ),
      ];

      const measures = extractMeasures(tasks);

      assert.ok(
        measures.find(
          (m) =>
            m.name === 'userConsentsFullVitalsTracking' && m.type === 'boolean',
        ),
        'userConsentsFullVitalsTracking should be detected as boolean',
      );
      assert.ok(
        measures.find(
          (m) => m.name === 'patientIsHome' && m.type === 'boolean',
        ),
        'patientIsHome should be detected as boolean',
      );
    });

    it('should extract all measures from BSN Goal Model rules', () => {
      // Complete set of tasks from BSN-Goal-Model_v0.4l.sleec (RuleT1-RuleT8)
      const tasks = [
        // T1: InformPurposeAndProtocol
        createTaskNode(
          'T1',
          '(not {purposeProtocolInformed})',
          '{purposeProtocolInformed}',
        ),
        // T2: ObtainConsentFullTracking
        createTaskNode(
          'T2',
          '{purposeProtocolInformed}',
          '{userConsentsFullVitalsTracking}',
        ),
        // T3: ObtainConsentPartialTracking
        createTaskNode(
          'T3',
          '({patientCanModifyOrRevokeAuthorizations} and ({riskLevel} = low))',
          '{userConsentsPartialVitalsTracking}',
        ),
        // T4: ApplyConsentProtocol
        createTaskNode(
          'T4',
          '{userConsentsPartialVitalsTracking}',
          '{profileAdapted}',
        ),
        // T5: TrackVitals
        createTaskNode(
          'T5',
          '((({patientDiscomfort} = low) or ({patientDiscomfort} = moderate)) or ({patientDiscomfort} = high))',
          '{vitalSignsCollected}',
        ),
        // T6: TrackVitalsOutdoors
        createTaskNode(
          'T6',
          '({userConsentsFullVitalsTracking} and (not {patientIsHome}))',
          '{vitalSignsCollected}',
        ),
        // T7: ProcessData
        createTaskNode('T7', '{vitalSignsCollected}', '{dataProcessed}'),
        // T8: DetectPatientHealthStatus
        createTaskNode('T8', '{dataProcessed}', '{dataAnalyzed}'),
      ];

      const measures = extractMeasures(tasks);

      // Scale measures (2)
      const scaleMeasures = measures.filter((m) => m.type === 'scale');
      assert.strictEqual(
        scaleMeasures.length,
        2,
        'Should have 2 scale measures',
      );

      const patientDiscomfort = scaleMeasures.find(
        (m) => m.name === 'patientDiscomfort',
      );
      assert.ok(
        patientDiscomfort,
        'patientDiscomfort should be a scale measure',
      );
      // Note: In the actual BSN model, patientDiscomfort uses d_low, d_moderate, d_high
      // but this test uses the simple low, moderate, high values
      assert.deepStrictEqual(
        patientDiscomfort.scaleValues,
        ['low', 'moderate', 'high'],
        'patientDiscomfort should have semantically ordered values',
      );

      const riskLevel = scaleMeasures.find((m) => m.name === 'riskLevel');
      assert.ok(riskLevel, 'riskLevel should be a scale measure');
      assert.deepStrictEqual(
        riskLevel.scaleValues,
        ['low'],
        'riskLevel should have scaleValues: ["low"]',
      );

      // Boolean measures (9)
      const booleanMeasures = measures.filter((m) => m.type === 'boolean');
      const expectedBooleans = [
        'dataAnalyzed',
        'dataProcessed',
        'patientCanModifyOrRevokeAuthorizations',
        'patientIsHome',
        'profileAdapted',
        'purposeProtocolInformed',
        'userConsentsFullVitalsTracking',
        'userConsentsPartialVitalsTracking',
        'vitalSignsCollected',
      ];
      assert.strictEqual(
        booleanMeasures.length,
        expectedBooleans.length,
        `Should have ${expectedBooleans.length} boolean measures`,
      );
      for (const name of expectedBooleans) {
        assert.ok(
          booleanMeasures.find((m) => m.name === name),
          `${name} should be a boolean measure`,
        );
      }
    });

    it('should return measures sorted alphabetically by name', () => {
      const tasks = [
        createTaskNode('T1', '{zebra}', '{apple}'),
        createTaskNode('T2', '{mango}', '{banana}'),
      ];

      const measures = extractMeasures(tasks);
      const names = measures.map((m) => m.name);

      assert.deepStrictEqual(names, ['apple', 'banana', 'mango', 'zebra']);
    });

    it('should return empty array when no measures found', () => {
      const tasks = [createTaskNode('T1', undefined, undefined)];

      const measures = extractMeasures(tasks);

      assert.deepStrictEqual(measures, []);
    });

    it('should not duplicate measures used in multiple tasks', () => {
      // vitalSignsCollected is used in T5, T6, T7
      const tasks = [
        createTaskNode('T5', undefined, '{vitalSignsCollected}'),
        createTaskNode('T6', undefined, '{vitalSignsCollected}'),
        createTaskNode('T7', '{vitalSignsCollected}', '{dataProcessed}'),
      ];

      const measures = extractMeasures(tasks);

      const vitalSignsCount = measures.filter(
        (m) => m.name === 'vitalSignsCollected',
      ).length;
      assert.strictEqual(
        vitalSignsCount,
        1,
        'vitalSignsCollected should appear only once',
      );
    });

    it('should mark measure as scale if used with = in any condition, even if used as boolean elsewhere', () => {
      // If a variable is used both as boolean and with =, it should be scale
      const tasks = [
        createTaskNode('T1', '{mixedVar}', undefined), // boolean usage
        createTaskNode('T2', '({mixedVar} = high)', undefined), // scale usage
      ];

      const measures = extractMeasures(tasks);

      const mixedVar = measures.find((m) => m.name === 'mixedVar');
      assert.ok(mixedVar, 'mixedVar should be found');
      assert.strictEqual(
        mixedVar.type,
        'scale',
        'mixedVar should be detected as scale when used with = anywhere',
      );
      assert.deepStrictEqual(
        mixedVar.scaleValues,
        ['high'],
        'mixedVar should have scaleValues: ["high"]',
      );
    });

    it('should semantically order scale values with prefixes: d_low, d_moderate, d_high', () => {
      // Actual BSN model uses prefixed values: d_low, d_moderate, d_high
      const tasks = [
        createTaskNode(
          'T5',
          '((({patientDiscomfort} = d_high) or ({patientDiscomfort} = d_low)) or ({patientDiscomfort} = d_moderate))',
          '{vitalSignsCollected}',
        ),
      ];

      const measures = extractMeasures(tasks);

      const patientDiscomfort = measures.find(
        (m) => m.name === 'patientDiscomfort',
      );
      assert.ok(patientDiscomfort, 'patientDiscomfort should be found');
      assert.strictEqual(patientDiscomfort.type, 'scale');
      assert.deepStrictEqual(
        patientDiscomfort.scaleValues,
        ['d_low', 'd_moderate', 'd_high'],
        'Values should be semantically ordered despite input order',
      );
    });

    it('should semantically order scale values with different prefixes: r_low, r_moderate, r_high', () => {
      const tasks = [
        createTaskNode('T1', '({riskLevel} = r_high)', undefined),
        createTaskNode('T2', '({riskLevel} = r_low)', undefined),
        createTaskNode('T3', '({riskLevel} = r_moderate)', undefined),
      ];

      const measures = extractMeasures(tasks);

      const riskLevel = measures.find((m) => m.name === 'riskLevel');
      assert.ok(riskLevel, 'riskLevel should be found');
      assert.strictEqual(riskLevel.type, 'scale');
      assert.deepStrictEqual(
        riskLevel.scaleValues,
        ['r_low', 'r_moderate', 'r_high'],
        'Values should be semantically ordered',
      );
    });

    it('should handle scale values with min/med/max pattern', () => {
      const tasks = [
        createTaskNode('T1', '({priority} = max)', undefined),
        createTaskNode('T2', '({priority} = min)', undefined),
        createTaskNode('T3', '({priority} = med)', undefined),
      ];

      const measures = extractMeasures(tasks);

      const priority = measures.find((m) => m.name === 'priority');
      assert.ok(priority, 'priority should be found');
      assert.deepStrictEqual(
        priority.scaleValues,
        ['min', 'med', 'max'],
        'Values should be semantically ordered',
      );
    });

    it('should fallback to alphabetical sort when no semantic pattern detected', () => {
      const tasks = [
        createTaskNode('T1', '({status} = zebra)', undefined),
        createTaskNode('T2', '({status} = apple)', undefined),
        createTaskNode('T3', '({status} = mango)', undefined),
      ];

      const measures = extractMeasures(tasks);

      const status = measures.find((m) => m.name === 'status');
      assert.ok(status, 'status should be found');
      assert.deepStrictEqual(
        status.scaleValues,
        ['apple', 'mango', 'zebra'],
        'Values should be alphabetically sorted when no pattern is detected',
      );
    });

    it('should deduplicate scale values', () => {
      const tasks = [
        createTaskNode('T1', '({level} = low)', undefined),
        createTaskNode('T2', '({level} = low)', undefined),
        createTaskNode('T3', '({level} = high)', undefined),
      ];

      const measures = extractMeasures(tasks);

      const level = measures.find((m) => m.name === 'level');
      assert.ok(level, 'level should be found');
      assert.deepStrictEqual(
        level.scaleValues,
        ['low', 'high'],
        'Duplicate values should be removed',
      );
    });
  });
});
