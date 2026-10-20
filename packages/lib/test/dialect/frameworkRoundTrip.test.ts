/**
 * The framework axis changes nothing for iStar models (goal-controller#171):
 * every example is in iStar 2.0, by its content and by its (absent) record,
 * and reads and writes back byte for byte through the framework's host; but
 * the KAOS and NFR seeds (examples/kaos, examples/nfr: DSM3's own files,
 * and KAOS's stress-test projects of goal-controller#181), which are their
 * framework's by their content and record none either.
 */
import { expect } from 'chai';
import {
  modelSettingsOf,
  recordedFramework,
  withModelSettings,
} from '../../../ui/lib/project';
import { parseModel } from '../../../ui/lib/workbench/dialects';
import { frameworkOfModel } from '../../../ui/lib/workbench/frameworks';
import { serializeModel } from '../../../ui/lib/workbench/pistar';
import { models } from './support/models';

const isModel = (text: string) => {
  if (!Array.isArray(JSON.parse(text).actors)) throw new Error('not a model');
};
const EXAMPLES = models('examples', isModel);

/** The framework an example is in: its folder's, for the KAOS and NFR seeds. */
const frameworkOf = (file: string) =>
  /^examples\/(kaos|nfr)\//.exec(file)?.[1] ?? 'istar-2.0';

describe('frameworks: the examples (#171)', () => {
  it('are all iStar 2.0 but the KAOS and NFR seeds, and record no framework', () => {
    expect(EXAMPLES.length).to.be.greaterThan(20);
    expect(
      EXAMPLES.filter(({ file }) => frameworkOf(file) !== 'istar-2.0'),
    ).to.have.length(6);
    for (const { file, model } of EXAMPLES) {
      expect(frameworkOfModel(model), file).to.equal(frameworkOf(file));
      expect(recordedFramework(model), file).to.equal(null);
      expect(modelSettingsOf(model).framework, file).to.equal('istar-2.0');
    }
  });

  it('read with their framework and write back byte for byte', () => {
    for (const { file, model } of EXAMPLES) {
      const read = (() => {
        try {
          return parseModel(model, undefined, 'istar-2.0');
        } catch {
          return null; // a model its mode can't read is another test's
        }
      })();
      if (read) expect(serializeModel(read, model), file).to.equal(model);
      expect(
        withModelSettings(model, { framework: 'istar-2.0' }),
        file,
      ).to.equal(model);
    }
  });
});
