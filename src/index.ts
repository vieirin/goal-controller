/* eslint-disable no-console */
import { writeFile } from 'fs';
import { loadPistarModel } from './GoalTree';
import { convertToTree } from './GoalTree/creation';
import { initLogger } from './logger/logger';
import { edgeDTMCTemplate } from './templateEngine/engine';

if (!process.argv.length) {
  console.error('missing file param');
  process.exit(1);
}
const model = loadPistarModel({ filename: process.argv[2] ?? '' });
const tree = convertToTree({ model });

const logger = initLogger(process.argv[2] ?? '');
writeFile(
  'output/edge.mp',
  edgeDTMCTemplate({ gm: tree, fileName: process.argv[2] ?? '' }),
  function (err) {
    if (err) {
      console.log(err);
      return;
    }
    console.log('The file was saved!');
    logger.close();
  },
);
