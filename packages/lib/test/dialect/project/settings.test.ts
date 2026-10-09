/**
 * The workbench's model settings over the project manifest
 * (packages/ui/lib/workbench/projectSettings.ts), and the Explorer's way in
 * (services/examples.ts): every example and every Recent entry opens with the
 * mode and options it opened with before projects.
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  EMBEDDED_KEY,
  modelSettingsOf,
  withModelSettings,
  type ProjectIndexEntry,
} from '../../../../ui/lib/project';
import {
  openingSettings,
  readModelOptions,
  withEngineOptions,
} from '../../../../ui/lib/workbench/projectSettings';
import {
  isEngineMode,
  planConversion,
  readModelMode,
  writeModelMode,
  type ModelMode,
} from '../../../../ui/lib/workbench/pistar';
import { isDialectMode } from '../../../../ui/lib/workbench/dialects';
import {
  DEFAULT_OPTIONS,
  type ModelSettings,
} from '../../../../ui/lib/workbench/types';
import { openExample } from '../../../../ui/services/examples';
import INDEX from '../../../../ui/lib/examples-manifest.json';
import { legacyRecordedMode, models } from '../support/models';

const EXAMPLES_DIR = join(__dirname, '../../../../../examples');
const EXAMPLES = models('examples', (text) => {
  if (!Array.isArray(JSON.parse(text).actors)) throw new Error('not a model');
});
const SESSION: ModelSettings = {
  engine: 'edgev2',
  options: DEFAULT_OPTIONS,
  live: true,
  pistar: false,
};

/** How the workbench chose a model's settings before projects (WorkbenchContext's openModel). */
const legacyOpening = (
  text: string,
  stored: Partial<ModelSettings> | undefined,
  current: ModelSettings,
): ModelSettings => {
  const recorded = readModelMode(text) ?? 'pistar';
  const base = stored ? { ...current, ...stored } : current;
  return isEngineMode(recorded)
    ? { ...base, pistar: false, dialect: undefined, engine: recorded }
    : {
        ...base,
        pistar: true,
        dialect: isDialectMode(recorded) ? recorded : undefined,
      };
};

/** The settings the workbench opens a model with now: the manifest's options over the rest. */
const opening = (
  text: string,
  stored: Partial<ModelSettings> | undefined,
  current: ModelSettings = SESSION,
): ModelSettings => {
  const settings = openingSettings(readModelMode(text), stored, current);
  return {
    ...settings,
    options: { ...settings.options, ...readModelOptions(text).options },
  };
};

/** examples/<group>/: the mode its models open in (Explorer's EXAMPLE_ENGINES before projects) */
const GROUP_MODE: Record<string, ModelMode> = {
  edge: 'edge',
  edgeV2: 'edgev2',
  sleec: 'sleec',
  mutrose: 'mutrose',
  'pistar-ext': 'pistarext',
};
const groupOf = (file: string) => file.split('/')[1] ?? '';
/** every example as the Explorer opens it: its folder's mode recorded */
const RECORDED = EXAMPLES.map(({ file, model }) => ({
  file,
  model: GROUP_MODE[groupOf(file)]
    ? writeModelMode(model, GROUP_MODE[groupOf(file)]!)
    : model,
}));
const edgeModel = RECORDED.find(({ file }) => groupOf(file) === 'edge')!.model;
const edgeV2Model = RECORDED.find(
  ({ file }) => groupOf(file) === 'edgeV2',
)!.model;

describe('ui model settings over the project manifest', () => {
  it('opens every example, bare or from Recent, with the settings it opened with before', () => {
    const recentEntries: (Partial<ModelSettings> | undefined)[] = [
      undefined,
      {
        engine: 'edge',
        options: { ...DEFAULT_OPTIONS, achievabilitySpace: 3 },
        live: false,
      },
      { options: { ...DEFAULT_OPTIONS, discretisation: 4, reduce: true } },
      { pistar: true, dialect: 'pistarext' },
    ];
    for (const { file, model } of [...EXAMPLES, ...RECORDED])
      for (const stored of recentEntries)
        expect(opening(model, stored), file).to.deep.equal(
          legacyOpening(model, stored, SESSION),
        );
  });

  it("takes the manifest's options over the ones kept in Recent", () => {
    const text = withEngineOptions(edgeV2Model, 'edgev2', {
      ...DEFAULT_OPTIONS,
      discretisation: 6,
    });
    const stored = {
      options: { ...DEFAULT_OPTIONS, discretisation: 4, reduce: true },
    };
    expect(opening(text, stored).options).to.deep.equal({
      ...DEFAULT_OPTIONS,
      discretisation: 6,
      reduce: true,
    });
  });

  it('reports what the manifest holds that the engine does not read, and does not use it', () => {
    const text = withModelSettings(edgeModel, {
      options: {
        discretisation: 6,
        achievabilitySpace: 'x',
        achievabilityspace: 3,
      },
    });
    const { options, problems } = readModelOptions(text);
    expect(options).to.deep.equal({});
    expect(
      problems.map((p) => [p.severity, p.source, p.message]),
    ).to.deep.equal([
      [
        'warning',
        'model settings',
        'Edge has no option "discretisation"; it is not used',
      ],
      [
        'warning',
        'model settings',
        '"x" is not a value of "achievabilitySpace"; it is not used',
      ],
      [
        'warning',
        'model settings',
        'Edge has no option "achievabilityspace"; it is not used',
      ],
    ]);
    const broken = JSON.stringify({
      ...JSON.parse(edgeModel),
      [EMBEDDED_KEY]: { version: 7 },
    });
    expect(
      readModelOptions(broken).problems.map((p) => p.severity),
    ).to.deep.equal(['error']);
    expect(readModelOptions('{ not json').problems).to.deep.equal([]);
  });

  it('never writes the project key when the options are the defaults', () => {
    for (const { file, model } of RECORDED) {
      const mode = readModelMode(model);
      if (!mode || !isEngineMode(mode)) continue;
      const applied = withEngineOptions(model, mode, DEFAULT_OPTIONS);
      expect(applied, file).to.equal(model);
      expect(JSON.parse(applied), file).not.to.have.property(EMBEDDED_KEY);
    }
  });

  it('writes the options an engine reads that differ, and a default set over a non-default base', () => {
    const options = {
      ...DEFAULT_OPTIONS,
      discretisation: 6,
      achievabilitySpace: 2,
      generateFluents: true,
    };
    expect(
      modelSettingsOf(withEngineOptions(edgeV2Model, 'edgev2', options))
        .options,
    ).to.deep.equal({
      discretisation: 6,
    });
    // the model says it is generated with N=10, not with what applies where it says nothing
    const base = { ...DEFAULT_OPTIONS, discretisation: 4 };
    expect(
      modelSettingsOf(
        withEngineOptions(edgeV2Model, 'edgev2', DEFAULT_OPTIONS, base),
      ).options,
    ).to.deep.equal({ discretisation: 10 });
  });

  it('drops the options the target does not read when a model is converted, and says so', () => {
    const text = withEngineOptions(edgeV2Model, 'edgev2', {
      ...DEFAULT_OPTIONS,
      discretisation: 6,
      reduce: true,
    });
    const plan = planConversion(text, 'sleec');
    expect(modelSettingsOf(plan.text)).to.deep.equal({
      mode: 'sleec',
      options: { reduce: true },
    });
    expect(plan.changes).to.include(
      'the model settings lose "discretisation": SLEEC does not read it',
    );
    expect(readModelOptions(plan.text).problems).to.deep.equal([]);
  });
});

describe('ui Explorer: examples opened as projects', () => {
  const read = (path: string) => readFileSync(join(EXAMPLES_DIR, path), 'utf8');
  const fetchLocal = async (url: string) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () =>
      read(
        decodeURIComponent(
          url.replace(
            /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/examples\//,
            '',
          ),
        ),
      ),
  });
  it('opens every example with the mode of its folder and the default options', async () => {
    const entries = INDEX as ProjectIndexEntry[];
    expect(entries.length).to.be.greaterThan(20);
    for (const entry of entries) {
      const opened = await openExample(entry, fetchLocal);
      const original = read(entry.path);
      const mode =
        GROUP_MODE[entry.group] ?? legacyRecordedMode(original) ?? 'pistar';
      expect(opened.fileName, entry.path).to.equal(entry.path.split('/').pop());
      expect(opened.project.source, entry.path).to.deep.equal({
        kind: 'github',
        repo: 'vieirin/goal-controller',
        ref: 'main',
        path: `examples/${entry.root}`,
      });
      expect(readModelMode(opened.text) ?? 'pistar', entry.path).to.equal(mode);
      const settings = opening(opened.text, opened.settings);
      expect(settings, entry.path).to.deep.equal(
        legacyOpening(opened.text, opened.settings, SESSION),
      );
      expect(settings.options, entry.path).to.deep.equal(DEFAULT_OPTIONS);
      // opening records the mode, and changes nothing else
      const model = JSON.parse(original);
      expect(JSON.parse(opened.text), entry.path).to.deep.equal(
        mode === 'pistar'
          ? model
          : {
              ...model,
              diagram: {
                ...model.diagram,
                customProperties: {
                  ...model.diagram?.customProperties,
                  engine: mode,
                },
              },
            },
      );
      if (legacyRecordedMode(original) === mode)
        expect(opened.text, entry.path).to.equal(original);
    }
  });
});
