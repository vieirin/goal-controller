#!/usr/bin/env node

// Import for CLI usage and re-export
import { writeFile } from 'fs';
import path from 'path';
import { GoalTree, Model } from '@goal-controller/goal-tree';
import { initLogger } from './logger/logger';
import { validate } from './prismValidator';
import { sleecTemplateEngine } from './sleecTemplateEngine';
import { generateValidatedPrismModel } from './templateEngine/engine';

// Re-export from @goal-controller/goal-tree for backward compatibility
export {
  GoalTree,
  Model,
  Node,
  cartesianProduct,
} from '@goal-controller/goal-tree';

export type {
  GoalNode,
  GoalTreeType,
  IStarModel,
  Relation,
  SleecProps,
  Type,
} from '@goal-controller/goal-tree';

// Core transformation engines (remain in lib)
export { generateValidatedPrismModel, sleecTemplateEngine };

// Validation
export { validate };

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

  const model = Model.load(inputFile);
  const tree = GoalTree.fromModel(model);

  const logger = initLogger(inputFile);
  const fileName = path.parse(inputFile).name;
  const outputPath = `output/${fileName}.prism`;

  writeFile(
    outputPath,
    sleecTemplateEngine(tree.nodes),
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
