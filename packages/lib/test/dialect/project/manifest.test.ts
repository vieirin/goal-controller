/** The UI's project module (packages/ui/lib/project): the manifest and its embedded form. */
import { expect } from 'chai';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import {
  EMBEDDED_KEY,
  ManifestError,
  manifestOfModel,
  modelSettingsOf,
  needsProjectFile,
  parseManifest,
  recordedMode,
  serializeManifest,
  setSettingsInManifest,
  settingsInManifest,
  singleModelManifest,
  withEmbeddedManifest,
  withModelSettings,
  type Manifest,
} from '../../../../ui/lib/project';
import {
  legacyRecordedMode as recordedModeOf,
  models,
} from '../support/models';

const isModel = (text: string) => {
  if (!Array.isArray(JSON.parse(text).actors)) throw new Error('not a model');
};
const EXAMPLES = models('examples', isModel);

const FULL: Manifest = {
  version: 1,
  dialect: 'edgev2',
  options: { discretisation: 10, taskLayout: 'taskModules' },
  models: [
    { path: 'models/a.txt' },
    {
      path: 'models/a-sleec.txt',
      dialect: 'sleec',
      options: { generateFluents: true },
    },
  ],
  projectResources: {
    properties: ['props/a.pctl'],
    variables: 'variables.json',
  },
  outputs: [{ model: 'models/a.txt', path: 'out/a.prism', engine: 'edgev2' }],
};

describe('project manifest', () => {
  it('reads what it writes', () => {
    const text = serializeManifest(FULL);
    expect(text.endsWith('}\n')).to.equal(true);
    expect(parseManifest(JSON.parse(text))).to.deep.equal(FULL);
  });

  it('defaults the lists a manifest leaves out', () => {
    expect(
      parseManifest({ version: 1, models: [{ path: 'm.txt' }] }),
    ).to.deep.equal({
      version: 1,
      models: [{ path: 'm.txt' }],
      projectResources: {},
      outputs: [],
    });
  });

  it('names where a manifest is wrong', () => {
    const bad = (value: unknown, at: RegExp) =>
      expect(() => parseManifest(value)).to.throw(ManifestError, at);
    bad({ version: 2, models: [] }, /^version: unsupported version 2/);
    bad({ version: 1, models: [{ path: '' }] }, /^models\[0\]\.path:/);
    bad(
      { version: 1, models: [{ path: 'm', options: { a: [] } }] },
      /^models\[0\]\.options\.a:/,
    );
    bad(
      { version: 1, models: [{ path: 'm' }, { path: 'm' }] },
      /^models\[1\]\.path: m is listed twice/,
    );
    bad(
      { version: 1, models: [], projectResources: { world: [1] } },
      /^projectResources\.world\[0\]:/,
    );
    bad(
      { version: 1, models: [], outputs: [{ model: 'm' }] },
      /^outputs\[0\]\.path:/,
    );
  });

  it('needs project.json from a second file on', () => {
    const one = singleModelManifest('m.txt', { dialect: 'edge' });
    expect(needsProjectFile(one)).to.equal(false);
    expect(
      needsProjectFile({ ...one, models: [...one.models, { path: 'n.txt' }] }),
    ).to.equal(true);
    expect(
      needsProjectFile({ ...one, projectResources: { world: 'w.xml' } }),
    ).to.equal(true);
    expect(
      needsProjectFile({ ...one, projectResources: { properties: [] } }),
    ).to.equal(false);
    expect(
      needsProjectFile({
        ...one,
        outputs: [{ model: 'm.txt', path: 'out/m.pm' }],
      }),
    ).to.equal(true);
    expect(needsProjectFile(FULL)).to.equal(true);
  });

  it("reads a model's settings over the project's, key by key", () => {
    expect(settingsInManifest(FULL, 'models/a.txt')).to.deep.equal({
      mode: 'edgev2',
      options: { discretisation: 10, taskLayout: 'taskModules' },
    });
    expect(settingsInManifest(FULL, 'models/a-sleec.txt')).to.deep.equal({
      mode: 'sleec',
      options: {
        discretisation: 10,
        taskLayout: 'taskModules',
        generateFluents: true,
      },
    });
  });

  it("keeps a one-model project's settings at project level, and overrides with more models", () => {
    const one = setSettingsInManifest(singleModelManifest('m.txt'), undefined, {
      mode: 'edge',
      options: { achievabilitySpace: 3 },
    });
    expect(one).to.deep.include({
      dialect: 'edge',
      options: { achievabilitySpace: 3 },
    });
    expect(one.models).to.deep.equal([{ path: 'm.txt' }]);
    const two = setSettingsInManifest(FULL, 'models/a.txt', {
      options: { discretisation: 4 },
    });
    expect(two.options).to.deep.equal(FULL.options);
    expect(two.models[0]).to.deep.equal({
      path: 'models/a.txt',
      options: { discretisation: 4 },
    });
    expect(() => setSettingsInManifest(FULL, 'nope.txt', {})).to.throw(
      /no model nope\.txt/,
    );
    // mode null clears, empty options drop the key
    expect(
      setSettingsInManifest(one, undefined, { mode: null, options: {} }),
    ).to.deep.equal(singleModelManifest('m.txt'));
  });
});

describe('project manifest embedded in a model', () => {
  it('reads every example as a one-model project with the mode it records', () => {
    expect(EXAMPLES.length).to.be.greaterThan(20);
    for (const { file, model } of EXAMPLES) {
      const manifest = manifestOfModel(model, file);
      expect(manifest.models, file).to.deep.equal([{ path: file }]);
      expect(needsProjectFile(manifest), file).to.equal(false);
      expect(manifest.dialect ?? null, file).to.equal(recordedModeOf(model));
      expect(recordedMode(model), file).to.equal(recordedModeOf(model));
      expect(manifest.options, file).to.equal(undefined);
    }
  });

  it('writes every example back byte for byte', () => {
    for (const { file, model } of EXAMPLES) {
      expect(
        withEmbeddedManifest(model, manifestOfModel(model)),
        file,
      ).to.equal(model);
      expect(withModelSettings(model, {}), file).to.equal(model);
    }
  });

  it('never adds the project key for default options', () => {
    for (const { file, model } of EXAMPLES) {
      const applied = withModelSettings(model, {
        mode: modelSettingsOf(model).mode,
        options: {},
      });
      expect(applied, file).to.equal(model);
      expect(JSON.parse(applied), file).not.to.have.property(EMBEDDED_KEY);
    }
  });

  it('keeps options in the project key, and drops it when they go', () => {
    const { model } = EXAMPLES.find(({ file }) =>
      file.startsWith('examples/edgeV2/'),
    )!;
    const withOptions = withModelSettings(model, {
      options: { discretisation: 4 },
    });
    expect(JSON.parse(withOptions)[EMBEDDED_KEY]).to.deep.equal({
      version: 1,
      options: { discretisation: 4 },
    });
    expect(modelSettingsOf(withOptions).options).to.deep.equal({
      discretisation: 4,
    });
    // the rest of the file as it was: indentation, key order, trailing newline
    expect(withOptions.endsWith('\n')).to.equal(model.endsWith('\n'));
    expect(withModelSettings(withOptions, { options: {} })).to.equal(model);
  });

  it('records the mode where the file always did, and removes it for piStar', () => {
    const bare = EXAMPLES.find(
      ({ model }) => recordedModeOf(model) === null,
    )!.model;
    const edge = withModelSettings(bare, { mode: 'edge' });
    expect(JSON.parse(edge).diagram.customProperties.engine).to.equal('edge');
    expect(JSON.parse(edge)).not.to.have.property(EMBEDDED_KEY);
    expect(recordedModeOf(edge)).to.equal('edge');
    expect(modelSettingsOf(edge).mode).to.equal('edge');
    const back = withModelSettings(edge, { mode: null });
    expect(recordedModeOf(back)).to.equal(null);
    const { diagram: _diagram, ...rest } = JSON.parse(back);
    const { diagram: _bareDiagram, ...bareRest } = JSON.parse(bare);
    expect(rest).to.deep.equal(bareRest);
  });

  it('refuses a project key that is not a manifest, and a project that needs project.json', () => {
    const { model } = EXAMPLES[0]!;
    const withKey = (value: unknown) =>
      JSON.stringify({ ...JSON.parse(model), [EMBEDDED_KEY]: value });
    expect(() => manifestOfModel(withKey('x'))).to.throw(
      ManifestError,
      /^project:/,
    );
    expect(() => manifestOfModel(withKey({ version: 9 }))).to.throw(
      /^project\.version:/,
    );
    expect(() =>
      manifestOfModel(withKey({ version: 1, options: { a: null } })),
    ).to.throw(/^project\.options\.a:/);
    expect(() => withEmbeddedManifest(model, FULL)).to.throw(/project\.json/);
    expect(recordedMode('not json')).to.equal(null);
  });
});

describe('project module boundary', () => {
  const ROOT = join(__dirname, '../../../../ui/lib/project');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const file = join(dir, name);
      return statSync(file).isDirectory() ? files(file) : [file];
    });
  // data and storage only: no React, Next, workbench, model library or engines
  const ALLOWED = [/^\.\.?\//, /^@goal-controller\/dialect$/, /^fflate$/];

  it('imports nothing outside itself but the dialect types and fflate', () => {
    for (const file of files(ROOT)) {
      const text = readFileSync(file, 'utf8');
      for (const [, from] of text.matchAll(
        /(?:from|import|require\()\s*['"]([^'"]+)['"]/g,
      )) {
        expect(
          ALLOWED.some((allowed) => allowed.test(from!)),
          `${relative(ROOT, file)}: ${from}`,
        ).to.equal(true);
        if (from!.startsWith('.'))
          expect(
            join(file, '..', from!).startsWith(ROOT),
            `${relative(ROOT, file)}: ${from}`,
          ).to.equal(true);
      }
    }
  });

  it('reads no browser global at module top level', () => {
    for (const file of files(ROOT)) {
      const topLevel = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => /^(export )?(const|let|var) |^[a-z]/.test(line));
      for (const line of topLevel)
        expect(line, relative(ROOT, file)).not.to.match(
          /\b(window|navigator|document|localStorage|indexedDB|fetch)\b/,
        );
    }
  });
});
