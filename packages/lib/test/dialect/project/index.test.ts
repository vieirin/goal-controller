/** The examples index (scripts/examples-manifest.mjs) as lib/project opens it. */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  githubStore,
  openProject,
  type ProjectIndexEntry,
} from '../../../../ui/lib/project';
import { recordedModeOf } from '../../../../ui/lib/workbench/dialects';
import INDEX from '../../../../ui/lib/examples-manifest.json';

const EXAMPLES = join(__dirname, '../../../../../examples');

/** githubStore over the local checkout: the URLs it asks for, and their files. */
const localStore = (entry: ProjectIndexEntry, requested: string[]) =>
  githubStore({
    ref: 'main',
    path: `examples/${entry.root}`,
    files: entry.files,
    form: entry.form,
    fetch: async (url) => {
      requested.push(url);
      const path = decodeURIComponent(
        url.replace(
          /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/main\/examples\//,
          '',
        ),
      );
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => readFileSync(join(EXAMPLES, path), 'utf8'),
      };
    },
  });

describe('project examples index', () => {
  const entries = INDEX as ProjectIndexEntry[];

  it('lists every example as a project', () => {
    expect(entries.length).to.be.greaterThan(20);
    for (const entry of entries) {
      expect(entry.form, entry.path).to.equal(
        entry.files.includes('project.json') ? 'file' : 'embedded',
      );
      if (entry.form === 'embedded') {
        expect(entry.files, entry.path).to.deep.equal(entry.models);
        expect(`${entry.root}/${entry.models[0]}`, entry.path).to.equal(
          entry.path,
        );
      }
    }
  });

  it('opens each entry as the index says, one request per file, with the mode its model records', async () => {
    for (const entry of entries) {
      const requested: string[] = [];
      const project = await openProject(localStore(entry, requested));
      expect(project.form, entry.path).to.equal(entry.form);
      expect(
        project.models.map((m) => m.path),
        entry.path,
      ).to.deep.equal(entry.models);
      if (entry.form === 'embedded') {
        expect(requested, entry.path).to.have.length(1);
        const [model] = project.models;
        expect(model!.settings.mode, entry.path).to.equal(
          recordedModeOf(model!.text),
        );
      }
    }
  });
});
