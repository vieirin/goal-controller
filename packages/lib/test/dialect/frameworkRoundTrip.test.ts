/**
 * The framework axis changes nothing for iStar models (goal-controller#171):
 * every example is in iStar 2.0, by its content and by its (absent) record,
 * and reads and writes back byte for byte through the framework's host; but
 * the KAOS and NFR seeds (examples/kaos, examples/nfr: DSM3's own files),
 * which are their framework's by their content and record none either.
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

/**
 * Examples the generic piStar path doesn't write back byte for byte on main
 * already, before #171 (a link's label beside its custom properties, an
 * actor without x/y, no saveDate): their engines' own paths are tested
 * elsewhere.
 */
const LOSSY_BEFORE = new Set([
  'examples/cgm/museum-guide/museum-guide.txt',
  'examples/cgm/museum-guide-costs/museum-guide-costs.txt',
  'examples/cgm/smart-home/smart-home.txt',
  'examples/grl/grl-own/grl-own.txt',
  'examples/grl/grl-smart-home/SmartHome2.txt',
  'examples/istardt/istardt-heating/Heating.txt',
  'examples/istardt/istardt-order/Order.txt',
  'examples/istardt/istardt-own/istardt-own.txt',
  'examples/tropos4as/cleaner-agent/cleaner-agent.txt',
  'examples/tropos4as/patient-monitoring/patient-monitoring.txt',
]);

/** The framework an example is in: its folder's, for the KAOS and NFR seeds. */
const frameworkOf = (file: string) =>
  /^examples\/(kaos|nfr)\//.exec(file)?.[1] ?? 'istar-2.0';

describe('frameworks: the examples (#171)', () => {
  it('are all iStar 2.0 but the KAOS and NFR seeds, and record no framework', () => {
    expect(EXAMPLES.length).to.be.greaterThan(20);
    expect(
      EXAMPLES.filter(({ file }) => frameworkOf(file) !== 'istar-2.0'),
    ).to.have.length(2);
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
      if (read && !LOSSY_BEFORE.has(file))
        expect(serializeModel(read, model), file).to.equal(model);
      expect(
        withModelSettings(model, { framework: 'istar-2.0' }),
        file,
      ).to.equal(model);
    }
  });
});
