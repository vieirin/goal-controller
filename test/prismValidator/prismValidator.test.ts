import * as assert from 'assert';
import { describe, it } from 'mocha';
import { loadPistarModel } from '../../src/GoalTree';
import { convertToTree } from '../../src/GoalTree/creation';
import { initLogger } from '../../src/logger/logger';
import { formatValidationReport, validate } from '../../src/prismValidator';
import { __test_only_exports__ as templateEngineInternals } from '../../src/templateEngine/engine';

const deliveryDroneExamples = [
  '1-minimal',
  '2-OrVariation',
  '3-interleavedPaltPseq',
  '4-interleavedChoicePDegradation',
  '5-allAnnotations',
  '6-allnotationsReduced',
  '7-minimalAll',
  '8-minimalMaintain',
  '9-minimalMaintainContext',
  '10-minimalMaintainResource',
];

describe('PRISM Validator - Delivery Drone Examples', () => {
  deliveryDroneExamples.forEach((exampleName) => {
    describe(exampleName, () => {
      it('should validate generated PRISM model matches expected elements', () => {
        const inputFile = `examples/deliveryDrone/${exampleName}.txt`;

        // Load and convert model
        const model = loadPistarModel({ filename: inputFile });
        const tree = convertToTree({ model });

        // Generate PRISM model
        const logger = initLogger(inputFile);
        const prismModel = templateEngineInternals.edgeDTMCTemplate({
          gm: tree,
          fileName: inputFile,
        });
        logger.close();

        // Validate
        const report = validate(tree, prismModel);

        // Check that all expected elements are present
        let hasErrors = false;
        const errors: string[] = [];

        // Check goals
        report.goals.forEach((validation, goalId) => {
          if (validation.module.missing > 0) {
            hasErrors = true;
            errors.push(`Goal ${goalId}: Missing module`);
          }
          if (validation.variables.missing > 0) {
            hasErrors = true;
            errors.push(
              `Goal ${goalId}: Missing variables: ${validation.variables.details.missing.join(
                ', ',
              )}`,
            );
          }
          if (validation.transitions.missing > 0) {
            hasErrors = true;
            errors.push(
              `Goal ${goalId}: Missing transitions: ${validation.transitions.details.missing.join(
                ', ',
              )}`,
            );
          }
          if (validation.formulas.missing > 0) {
            hasErrors = true;
            errors.push(
              `Goal ${goalId}: Missing formulas: ${validation.formulas.details.missing.join(
                ', ',
              )}`,
            );
          }
          if (validation.contextVariables.missing > 0) {
            hasErrors = true;
            errors.push(
              `Goal ${goalId}: Missing context variables: ${validation.contextVariables.details.missing.join(
                ', ',
              )}`,
            );
          }
        });

        // Check ChangeManager
        if (report.changeManager.taskVariables.missing > 0) {
          hasErrors = true;
          errors.push(
            `ChangeManager: Missing task variables: ${report.changeManager.taskVariables.details.missing.join(
              ', ',
            )}`,
          );
        }
        if (report.changeManager.taskTransitions.missing > 0) {
          hasErrors = true;
          errors.push(
            `ChangeManager: Missing task transitions: ${report.changeManager.taskTransitions.details.missing.join(
              ', ',
            )}`,
          );
        }

        // Check System
        if (report.system.contextVariables.missing > 0) {
          hasErrors = true;
          errors.push(
            `System: Missing context variables: ${report.system.contextVariables.details.missing.join(
              ', ',
            )}`,
          );
        }
        if (report.system.resourceVariables.missing > 0) {
          hasErrors = true;
          errors.push(
            `System: Missing resource variables: ${report.system.resourceVariables.details.missing.join(
              ', ',
            )}`,
          );
        }

        if (hasErrors) {
          // eslint-disable-next-line no-console
          console.error('\n' + formatValidationReport(report));
          assert.fail(
            `Validation failed for ${exampleName}:\n${errors.join('\n')}`,
          );
        }

        // Summary assertion
        assert.strictEqual(
          report.summary.totalMissing,
          0,
          `Expected no missing elements, but found ${report.summary.totalMissing} missing elements`,
        );
      });

      it('should have emitted at least as many elements as expected', () => {
        const inputFile = `examples/deliveryDrone/${exampleName}.txt`;

        // Load and convert model
        const model = loadPistarModel({ filename: inputFile });
        const tree = convertToTree({ model });

        // Generate PRISM model
        const logger = initLogger(inputFile);
        const prismModel = templateEngineInternals.edgeDTMCTemplate({
          gm: tree,
          fileName: inputFile,
        });
        logger.close();

        // Validate
        const report = validate(tree, prismModel);

        // Check that we have at least as many emitted as expected (may have extra)
        assert.ok(
          report.summary.totalEmitted >= report.summary.totalExpected,
          `Emitted count (${report.summary.totalEmitted}) should be >= expected count (${report.summary.totalExpected}) for ${exampleName}`,
        );
        assert.strictEqual(
          report.summary.totalMissing,
          0,
          `Should have no missing elements for ${exampleName}`,
        );
      });

      it('should have exactly one achievability formula per goal, plus one maintain formula for maintain goals', () => {
        const inputFile = `examples/deliveryDrone/${exampleName}.txt`;

        // Load and convert model
        const model = loadPistarModel({ filename: inputFile });
        const tree = convertToTree({ model });

        // Generate PRISM model
        const logger = initLogger(inputFile);
        const prismModel = templateEngineInternals.edgeDTMCTemplate({
          gm: tree,
          fileName: inputFile,
        });
        logger.close();

        // Validate
        const report = validate(tree, prismModel);

        // Check each goal's formula count
        report.goals.forEach((validation, goalId) => {
          // Each goal should have exactly 1 achievability formula
          // Maintain goals should have an additional 1 maintain formula (total 2)
          // Non-maintain goals should have exactly 1 formula
          const expectedFormulaCount = validation.formulas.expected;
          const emittedFormulaCount = validation.formulas.emitted;

          assert.strictEqual(
            emittedFormulaCount,
            expectedFormulaCount,
            `Goal ${goalId} should have exactly ${expectedFormulaCount} formula(s) (1 achievability + ${
              expectedFormulaCount - 1
            } maintain), but found ${emittedFormulaCount}. Formulas: ${validation.formulas.details.emitted.join(
              ', ',
            )}`,
          );

          // Verify expected count is correct: 1 for non-maintain, 2 for maintain
          assert.ok(
            expectedFormulaCount === 1 || expectedFormulaCount === 2,
            `Goal ${goalId} should have 1 or 2 formulas, but expected count is ${expectedFormulaCount}`,
          );

          if (expectedFormulaCount === 2) {
            // Should have both achievability and maintain formulas
            const formulas = validation.formulas.details.emitted;
            assert.ok(
              formulas.some((f) => f.endsWith('_achievable')),
              `Goal ${goalId} (maintain goal) should have achievability formula, but found: ${formulas.join(
                ', ',
              )}`,
            );
            assert.ok(
              formulas.some((f) => f.endsWith('_achieved_maintain')),
              `Goal ${goalId} (maintain goal) should have maintain formula, but found: ${formulas.join(
                ', ',
              )}`,
            );
          } else {
            // Should only have achievability formula
            const formulas = validation.formulas.details.emitted;
            assert.ok(
              formulas.some((f) => f.endsWith('_achievable')),
              `Goal ${goalId} should have achievability formula, but found: ${formulas.join(
                ', ',
              )}`,
            );
            assert.ok(
              !formulas.some((f) => f.endsWith('_achieved_maintain')),
              `Goal ${goalId} (non-maintain goal) should not have maintain formula, but found: ${formulas.join(
                ', ',
              )}`,
            );
          }
        });
      });
    });
  });
});
