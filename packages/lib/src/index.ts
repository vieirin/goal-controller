#!/usr/bin/env node

// Import for CLI usage and re-export
import { writeFile } from 'fs';
import path from 'path';
import { loadPistarModel, validateModel } from './GoalTree';
import { convertToTree } from './GoalTree/creation';
import { dumpTreeToJSON } from './GoalTree/utils';
import { initLogger } from './logger/logger';
import { validate } from './prismValidator';
import { sleecTemplateEngine } from './sleecTemplateEngine';
import { generateValidatedPrismModel } from './templateEngine/engine';

// Core transformation engines
export { generateValidatedPrismModel, sleecTemplateEngine };

// Decision variables config
export { DEFAULT_ACHIEVABILITY_SPACE } from './templateEngine/decisionVariables';

// Goal Tree utilities
export { convertToTree, dumpTreeToJSON, loadPistarModel, validateModel };

// Variable extraction
export {
  getTaskAchievabilityVariables,
  treeContextVariables,
} from './GoalTree/treeVariables';

// Validation
export { validate };

// Types
export type {
  GoalNode,
  GoalTree,
  Model,
  Relation,
  SleecProps,
  Type,
} from './GoalTree/types';

// Logger
export type { LoggerReport } from './logger/logger';
export { initLogger };

// CLI entry point - if this file is executed directly, run the CLI script

if (require.main === module) {
  /* eslint-disable no-console */
  // Parse command line arguments
  const args = process.argv.slice(2);
  const inputFile = args.find(
    (arg: string) => !arg.startsWith('--') && !arg.startsWith('-'),
  );

  if (!inputFile) {
    console.error('missing file param');
    console.error('Usage: goal-controller <file>');
    process.exit(1);
  }

  const model = loadPistarModel({ filename: inputFile });
  const tree = convertToTree({ model });

  const logger = initLogger(inputFile);
  const fileName = path.parse(inputFile).name;
  const outputPath = `output/${fileName}.prism`;

  writeFile(
    outputPath,
    sleecTemplateEngine(tree),
    function (err: Error | null) {
      if (err) {
        console.log(err);
        logger.close();
        return;
      }
      console.log(`The file was saved to ${outputPath}!`);
      logger.close();
    },
  );
}
