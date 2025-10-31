import { writeFile } from 'fs';
import { loadPistarModel } from './GoalTree';
import { convertToTree } from './GoalTree/creation';
import { edgeDTMCTemplate } from './templateEngine/template';

if (!process.argv.length) {
  console.error('missing file param');
  process.exit(1);
}
const model = loadPistarModel({ filename: process.argv[2] ?? '' });
const tree = convertToTree({ model });

writeFile(
  'output/edge.mp',
  edgeDTMCTemplate({ gm: tree, fileName: process.argv[2] ?? '' }),
  function (err) {
    if (err) {
      return console.log(err);
    }
    console.log('The file was saved!');
  }
);
