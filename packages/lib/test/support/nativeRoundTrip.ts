/**
 * The round-trip contract every dialect with native files runs on its
 * fixtures (goal-controller#143; src/importers/native.ts): each fixture
 * reads without an error; with a writer, a model read from it, written and
 * read back, is the same but for the format's `lossy` paths; and a
 * lossless fixture (one that holds nothing the model doesn't keep), read
 * and written, is itself in the format's canonical form.
 */
import { expect } from 'chai';
import type { AnyDialect, NativeFileContext } from '@goal-controller/dialect';
import { modelRoundTrip, textRoundTrip } from '../../src/importers/native';

export type NativeFixture = {
  /** shown in the test's name: the fixture's file */
  name: string;
  /** the native file's id in the dialect */
  file: string;
  text: string;
  /** whether it holds only what the model keeps: `write(read(f))` is `f`, canonically */
  lossless?: boolean;
  context?: Partial<NativeFileContext>;
};

export const describeNativeRoundTrips = (
  dialect: Pick<AnyDialect, 'name' | 'nativeFiles'>,
  fixtures: readonly NativeFixture[],
): void => {
  describe(`${dialect.name}: its native files round-trip (#143)`, () => {
    for (const fixture of fixtures) {
      const file = dialect.nativeFiles?.[fixture.file];
      const context: NativeFileContext = {
        modelName: fixture.name.replace(/\.[^.]*$/, ''),
        ...fixture.context,
      };
      it(`${fixture.name} is a ${fixture.file} file it reads`, () => {
        expect(file, `no native file ${fixture.file}`).not.to.equal(undefined);
        const read = file!.read(fixture.text, context);
        expect(
          read.diagnostics.filter((d) => d.severity === 'error'),
        ).to.deep.equal([]);
        expect(read.model).not.to.equal(null);
      });
      if (!file?.write) continue;
      it(`${fixture.name}: its model, written and read back, is itself but for ${file.lossy?.length ? file.lossy.join(', ') : 'nothing'}`, () => {
        const { model } = file.read(fixture.text, context);
        const trip = modelRoundTrip(file, model!, context);
        expect(trip.problem).to.equal(null);
      });
      if (fixture.lossless)
        it(`${fixture.name}: read and written, it is itself${file.canonical ? ', canonically' : ''}`, () => {
          const trip = textRoundTrip(file, fixture.text, context);
          expect(trip.problem).to.equal(null);
        });
    }
  });
};
