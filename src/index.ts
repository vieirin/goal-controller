import { writeFile } from 'fs';
import { loadModel } from './ObjectiveTree';
import { convertToTree } from './ObjectiveTree/creation';
import { edgeDTMCTemplate } from './dtmc/template';

if (!process.argv.length) {
  console.error('missing file param');
  process.exit(1);
}
const model = loadModel({ filename: process.argv[2] ?? '' });
const tree = convertToTree({ model });
console.log(edgeDTMCTemplate({ gm: tree }));

writeFile('output/edge.mp', edgeDTMCTemplate({ gm: tree }), function (err) {
  if (err) {
    return console.log(err);
  }
  console.log('The file was saved!');
});
