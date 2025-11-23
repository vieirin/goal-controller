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
    });
  });
});
