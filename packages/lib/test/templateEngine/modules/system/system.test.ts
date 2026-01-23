import * as assert from 'assert';
import { existsSync } from 'fs';
import { describe, it } from 'mocha';
import { __test_only_exports__ } from '../../../../src/templateEngine/modules/system/system';

const { extractOldSystemTransitions } = __test_only_exports__;

// Helper to check if output file exists
// Note: extractOldSystemTransitions looks for output/${baseName}.prism relative to cwd
// When running from packages/lib, check both local and root output folders
const outputFileExists = (inputFileName: string): boolean => {
  const baseName = inputFileName.split('/').pop()?.replace('.txt', '') || '';
  // Check where extractOldSystemTransitions will look (output/ relative to cwd)
  // AND where the files actually are (../../output from packages/lib)
  return existsSync(`output/${baseName}.prism`) || existsSync(`../../output/${baseName}.prism`);
};

describe('extractOldSystemTransitions', () => {
  describe('8-minimalMaintain', () => {
    it('should extract all transitions from System module', function () {
      const fileName = '../../examples/experiments/8-minimalMaintain.txt';
      if (!outputFileExists(fileName)) {
        this.skip(); // Skip if output file doesn't exist
      }
      const transitions = extractOldSystemTransitions(fileName);

      // Should have 4 transitions
      assert.strictEqual(transitions.length, 4, 'Should extract 4 transitions');

      // Verify each transition is present
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T3]')),
        'Should contain [achieved_T3] transition',
      );
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T4]')),
        'Should contain [achieved_T4] transition',
      );
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T7]')),
        'Should contain [achieved_T7] transition',
      );
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T6]')),
        'Should contain [achieved_T6] transition',
      );

      // Verify transitions contain the expected content
      assert.ok(
        transitions.some((t) => t.includes("(inFlight'=true)")),
        'Should contain inFlight update',
      );
      assert.ok(
        transitions.some((t) => t.includes("(commLink'=true)")),
        'Should contain commLink=true update',
      );
    });
  });

  describe('9-minimalMaintainContext', () => {
    it('should extract all transitions from System module', function () {
      const fileName = '../../examples/experiments/9-minimalMaintainContext.txt';
      if (!outputFileExists(fileName)) {
        this.skip(); // Skip if output file doesn't exist
      }
      const transitions = extractOldSystemTransitions(fileName);

      // Should have 7 transitions
      assert.strictEqual(transitions.length, 7, 'Should extract 7 transitions');

      // Verify each transition is present
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T1]')),
        'Should contain [achieved_T1] transition',
      );
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T4]')),
        'Should contain [achieved_T4] transition',
      );
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T7]')),
        'Should contain [achieved_T7] transition',
      );
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T3]')),
        'Should contain [achieved_T3] transition',
      );
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T6]')),
        'Should contain [achieved_T6] transition',
      );

      // Verify transitions contain the expected content
      assert.ok(
        transitions.some((t) => t.includes("(missionReady'=true)")),
        'Should contain missionReady update',
      );
      assert.ok(
        transitions.some((t) => t.includes("(lowBattery'=true)")),
        'Should contain lowBattery update',
      );
      assert.ok(
        transitions.some((t) => t.includes("(hasMoreDelivery'=true)")),
        'Should contain hasMoreDelivery update',
      );
    });
  });

  describe('10-minimalMaintainResource', () => {
    it('should extract all transitions from System module', function () {
      const fileName = '../../examples/experiments/10-minimalMaintainResource.txt';
      if (!outputFileExists(fileName)) {
        this.skip(); // Skip if output file doesn't exist
      }
      const transitions = extractOldSystemTransitions(fileName);

      // Should have 7 transitions
      assert.strictEqual(transitions.length, 7, 'Should extract 7 transitions');

      // Verify each transition is present
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T1]')),
        'Should contain [achieved_T1] transition',
      );
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T4]')),
        'Should contain [achieved_T4] transition',
      );
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T7]')),
        'Should contain [achieved_T7] transition',
      );
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T3]')),
        'Should contain [achieved_T3] transition',
      );
      assert.ok(
        transitions.some((t) => t.includes('[achieved_T6]')),
        'Should contain [achieved_T6] transition',
      );

      // Verify transitions contain the expected content
      assert.ok(
        transitions.some((t) => t.includes("(missionReady'=true)")),
        'Should contain missionReady update',
      );
      assert.ok(
        transitions.some((t) => t.includes("(R0'=max(0, R0-2))")),
        'Should contain R0 update with max function',
      );
      assert.ok(
        transitions.some((t) => t.includes("(R0'=max(0, R0-1))")),
        'Should contain R0 update with max function (different value)',
      );
    });
  });

  describe('edge cases', () => {
    it('should return empty array for non-existent file', () => {
      const fileName = '../../examples/experiments/non-existent-file.txt';
      const transitions = extractOldSystemTransitions(fileName);

      assert.strictEqual(
        transitions.length,
        0,
        'Should return empty array for non-existent file',
      );
    });

    it('should preserve original line formatting', function () {
      const fileName = '../../examples/experiments/8-minimalMaintain.txt';
      if (!outputFileExists(fileName)) {
        this.skip(); // Skip if output file doesn't exist
      }
      const transitions = extractOldSystemTransitions(fileName);

      // All transitions should preserve their original formatting
      transitions.forEach((transition) => {
        assert.ok(
          transition.includes('[') && transition.includes(']'),
          'Transition should preserve bracket format',
        );
        assert.ok(
          transition.includes('->'),
          'Transition should preserve arrow format',
        );
      });
    });

    it('should only extract transitions from System module', function () {
      const fileName = '../../examples/experiments/8-minimalMaintain.txt';
      if (!outputFileExists(fileName)) {
        this.skip(); // Skip if output file doesn't exist
      }
      const transitions = extractOldSystemTransitions(fileName);

      // Verify no transitions from other modules are included
      transitions.forEach((transition) => {
        // Should not contain goal module transitions
        assert.ok(
          !transition.includes('[pursue_G'),
          'Should not contain goal pursue transitions',
        );
        assert.ok(
          !transition.includes('[skip_G'),
          'Should not contain goal skip transitions',
        );
        // Should not contain ChangeManager transitions
        assert.ok(
          !transition.includes('[pursue_T'),
          'Should not contain task pursue transitions',
        );
        assert.ok(
          !transition.includes('[try_T'),
          'Should not contain task try transitions',
        );
      });
    });
  });
});
