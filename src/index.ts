import { writeFile } from 'fs';
import { loadModel } from './ObjectiveTree';
import { convertToTree } from './ObjectiveTree/creation';
import { egdeMDPTemplate } from './mdp/template';

if (!process.argv.length) {
  console.error('missing file param');
  process.exit(1);
}

const model = loadModel({ filename: process.argv[2] });
const tree = convertToTree({ model });
// console.log(egdeMDPTemplate({ gm: tree }));

writeFile('output/edge.mp', egdeMDPTemplate({ gm: tree }), function (err) {
  if (err) {
    return console.log(err);
  }
  console.log('The file was saved!');
});
