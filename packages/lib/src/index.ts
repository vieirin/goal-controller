#!/usr/bin/env node

// Import for CLI usage and re-export
import { GoalTree, Model } from '@goal-controller/goal-tree';
import { writeFile } from 'fs';
import path from 'path';
import { readPreviousOutput } from './cli/previousOutput';
import { edgeEngineMapper, generateValidatedPrismModel } from './engines/edge';
import { initLogger } from './engines/edge/logger/logger';
import { validate } from './engines/edge/validator';
import {
  edgeEngineMapper as edgeV2EngineMapper,
  generateValidatedPrismModel as generateEdgeV2PrismModel,
} from './engines/edgeV2';
import { initLogger as initEdgeV2Logger } from './engines/edgeV2/logger/logger';
import { sleecTemplateEngine } from './engines/sleec';

export type {
  EngineMapper,
  GoalNode,
  GoalTreeType,
  IStarModel,
  RawProps,
  Relation,
  Type,
} from '@goal-controller/goal-tree';

// Re-export GoalTree and Model for runtime usage (Model.load, GoalTree.fromModel)
export { GoalTree, Model };

// Decision variables config
export { DEFAULT_ACHIEVABILITY_SPACE } from './engines/edge/template/decisionVariables';

// Edge engine types and mapper
export {
  edgeEngineMapper,
  type EdgeGoalNode,
  type EdgeGoalTree,
  type EdgeTask,
} from './engines/edge';

// EdgeV2 engine mapper and template
export { edgeV2EngineMapper, generateEdgeV2PrismModel, initEdgeV2Logger };
// Custom properties each engine reads from the goal model (for editors)
export {
  EDGE_GOAL_KEYS,
  EDGE_RESOURCE_KEYS,
  EDGE_TASK_KEYS,
} from './engines/edge/mapper';
export {
  EDGE_GOAL_KEYS as EDGE_V2_GOAL_KEYS,
  EDGE_RESOURCE_KEYS as EDGE_V2_RESOURCE_KEYS,
  EDGE_TASK_KEYS as EDGE_V2_TASK_KEYS,
} from './engines/edgeV2/mapper';
export {
  SLEEC_GOAL_KEYS,
  SLEEC_TASK_KEYS,
  SLEEC_QUALITY_KEYS,
} from './engines/sleec/mapper';

export {
  DEFAULT_TASK_LAYOUT as EDGE_V2_DEFAULT_TASK_LAYOUT,
  type TaskLayout as EdgeV2TaskLayout,
} from './engines/edgeV2/template/common';
export type {
  EdgeGoalNode as EdgeV2GoalNode,
  EdgeGoalTree as EdgeV2GoalTree,
  EdgeTask as EdgeV2Task,
} from './engines/edgeV2';
export type {
  Decision,
  EdgeGoalProps,
  EdgeTaskProps,
  ExecCondition,
  GoalExecutionDetail,
} from './engines/edge';

// SLEEC engine types and mapper
export {
  sleecEngineMapper,
  type SleecGoalNode,
  type SleecGoalTree,
  type SleecTask,
} from './engines/sleec';
export type { SleecGoalProps, SleecTaskProps } from './engines/sleec';

// Core transformation engines (remain in lib)
export { generateValidatedPrismModel, sleecTemplateEngine };

// Validation
export { validate };
export type { Check, CheckContext } from './engines/checks';
export {
  edgeGoalChecks,
  edgeTaskChecks,
  edgeResourceChecks,
  edgeCheckRegistry,
  firstResourceIssue,
  type EdgeCheckName,
} from './engines/edgeChecks';

// Logger
export type { LoggerReport } from './engines/edge/logger/logger';
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
  const tree = GoalTree.fromModel(model, edgeEngineMapper);

  const logger = initLogger(inputFile);
  const fileName = path.basename(inputFile);
  const baseName = path.parse(inputFile).name;
  const outputPath = `output/${baseName}.prism`;
  const previousOutput = readPreviousOutput(baseName);

  writeFile(
    outputPath,
    generateValidatedPrismModel({ gm: tree.nodes, fileName, previousOutput }),
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
