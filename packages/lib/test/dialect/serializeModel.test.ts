/**
 * The workbench's edits write a model back through serializeModel
 * (`serializeModel(edit(parseModel(text)), text)`), so reading and writing
 * an example with no edit must give its text back byte for byte: each
 * object's key order, an absent saveDate (istar-ts 0.13.4, goal-controller#171).
 */
import { expect } from 'chai';
import { parseModel } from '../../../ui/lib/workbench/dialects';
import { serializeModel } from '../../../ui/lib/workbench/pistar';
import { models } from './support/models';

const isModel = (text: string) => {
  if (!Array.isArray(JSON.parse(text).actors)) throw new Error('not a model');
};
const EXAMPLES = models('examples', isModel);

/** Examples the mode they record can't read (an element kind of their own). */
const UNREADABLE = ['examples/pistar-ext/iStar4RationalAgents.txt'];

describe('serializeModel: the examples (#171)', () => {
  it('write back byte for byte as they are read', () => {
    const unreadable: string[] = [];
    for (const { file, model } of EXAMPLES) {
      let read;
      try {
        read = parseModel(model);
      } catch {
        unreadable.push(file);
        continue;
      }
      expect(serializeModel(read, model), file).to.equal(model);
    }
    expect(unreadable).to.deep.equal(UNREADABLE);
    expect(EXAMPLES.length - unreadable.length).to.be.greaterThan(90);
  });
});
