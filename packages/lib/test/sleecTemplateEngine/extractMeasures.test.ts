import * as assert from 'assert';
import { describe, it } from 'mocha';
import { extractMeasures, Measure } from '../../src/sleecTemplateEngine/index';
import type { GoalNode } from '../../src/GoalTree/types';

/**
 * Helper to create a minimal GoalNode with only the properties needed for testing
 */
const createTaskNode = (
  id: string,
  preCond?: string,
  postCond?: string,
): GoalNode =>
  ({
    id,
    type: 'task',
    properties: {
      PreCond: preCond,
      PostCond: postCond,
    },
  }) as GoalNode;

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

      assert.ok(
        measures.find((m) => m.name === 'riskLevel' && m.type === 'scale'),
        'riskLevel should be detected as scale',
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

      assert.ok(
        measures.find(
          (m) => m.name === 'patientDiscomfort' && m.type === 'scale',
        ),
        'patientDiscomfort should be detected as scale',
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
      assert.ok(
        scaleMeasures.find((m) => m.name === 'patientDiscomfort'),
        'patientDiscomfort should be a scale measure',
      );
      assert.ok(
        scaleMeasures.find((m) => m.name === 'riskLevel'),
        'riskLevel should be a scale measure',
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

      assert.ok(
        measures.find((m) => m.name === 'mixedVar' && m.type === 'scale'),
        'mixedVar should be detected as scale when used with = anywhere',
      );
    });
  });
});
