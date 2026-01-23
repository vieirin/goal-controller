/* eslint-disable no-console */
import { writeFile } from 'fs';
import path from 'path';
import { loadPistarModel } from './GoalTree';
import { convertToTree } from './GoalTree/creation';
import { initLogger } from './logger/logger';
import { sleecTemplateEngine } from './sleecTemplateEngine';

// Parse command line arguments
const args = process.argv.slice(2);
// const cleanFlag = args.includes('--clean') || args.includes('-c');
const inputFile = args.find(
  (arg) => !arg.startsWith('--') && !arg.startsWith('-'),
);

if (!inputFile) {
  console.error('missing file param');
  console.error('Usage: npx ts-node src/index.ts <file> [--clean|-c]');
  process.exit(1);
}

const model = loadPistarModel({ filename: inputFile });
const tree = convertToTree({ model });

const logger = initLogger(inputFile);
const fileName = path.parse(inputFile).name;
const outputPath = `output/${fileName}.prism`;

writeFile(outputPath, sleecTemplateEngine(tree), function (err) {
  if (err) {
    console.log(err);
    logger.close();
    return;
  }
  console.log(`The file was saved to ${outputPath}!`);
  logger.close();
});
