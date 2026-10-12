/**
 * The definition pool in the workbench (goal-controller#59): a Notation
 * line's position as a model field's and back, a rename applied to the
 * project's files and to the model, the pool's problems in Problems.
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { goalView } from '@goal-controller/goal-tree';
import { parsePistar } from '../../../../goal-tree/node_modules/@istar-ts/core';
import {
  createPool,
  mutrosePool,
  renameEdits,
  type PoolEdit,
} from '../../../src';
import { ENGINE_DIALECTS } from '../../../../ui/lib/workbench/engineDialects';
import { notationDocument } from '../../../../ui/lib/workbench/notationDocument';
import {
  appliedPoolEdits,
  notationPosition,
  notationRange,
  poolDocuments,
  type PoolWorkspace,
} from '../../../../ui/lib/workbench/poolDocuments';
import { poolSupport } from '../../../../ui/lib/workbench/poolSupport';
import { serviceProblemsNow } from '../../../../ui/lib/workbench/diagnosticsStore';
import { readOnlyEditor } from '../../../../ui/lib/workbench/codemirror';
import { insertNewlineAndIndent } from '../../../../ui/node_modules/@codemirror/commands';
import {
  EditorState,
  type Transaction,
} from '../../../../ui/node_modules/@codemirror/state';
import { EditorView } from '../../../../ui/node_modules/@codemirror/view';

const PROJECT = join(
  __dirname,
  '../../../../../examples/projects/medicine-delivery',
);
const read = (path: string) => readFileSync(join(PROJECT, path), 'utf8');
const MODEL = read('gm/MedicineDelivery.txt');
const RESOURCES = [
  { kind: 'world', path: 'knowledge/world_db.xml' },
  { kind: 'hddl', path: 'hddl/domain.hddl' },
  { kind: 'configuration', path: 'configuration/configuration.json' },
].map((resource) => ({ ...resource, text: read(resource.path) }));
const definition = ENGINE_DIALECTS.mutrose;

const workspaceOf = (model: string, resources = RESOURCES): PoolWorkspace => ({
  tree: goalView(parsePistar(model), definition),
  resources,
});

describe('the definition pool in the workbench', () => {
  const workspace = workspaceOf(MODEL);
  const doc = notationDocument(definition, workspace.tree!).text;

  it('reads a Notation position as a model field’s, and shows a field’s range there', () => {
    // `AT1: NavigateTo`: in the name
    const name = doc.indexOf('NavigateTo') + 2;
    expect(
      notationPosition(definition, workspace.tree!, doc, name),
    ).to.deep.equal({
      document: 'model:AT1:name',
      offset: 2,
    });
    // a property line: in its value
    const params = doc.indexOf('Params room') + 'Params '.length;
    expect(
      notationPosition(definition, workspace.tree!, doc, params),
    ).to.deep.equal({
      document: 'model:AT1:Params',
      offset: 0,
    });
    const range = notationRange(definition, workspace.tree!, doc, {
      document: 'model:G2:QueriedProperty',
      from: 'world_db->select(r:'.length,
      to: 'world_db->select(r:Request'.length,
    })!;
    expect(doc.slice(range.from, range.to)).to.equal('Request');
  });

  it('applies a rename to the resources and the model, leaving the pool whole', () => {
    const index = createPool(mutrosePool).update(poolDocuments(workspace));
    const world = RESOURCES[0]!.text;
    const edits = renameEdits(
      index,
      {
        document: 'knowledge/world_db.xml',
        offset: world.indexOf('Request') + 1,
      },
      'Order',
    ) as PoolEdit[];
    const result = appliedPoolEdits(edits, {
      resources: Object.fromEntries(RESOURCES.map((r) => [r.path, r.text])),
      tree: workspace.tree,
      modelText: MODEL,
    });
    expect(Object.keys(result.resources).sort()).to.deep.equal([
      'configuration/configuration.json',
      'knowledge/world_db.xml',
    ]);
    expect(result.modelText).to.include('requests : Sequence(Order)');
    expect(result.modelText).to.include(
      'world_db->select(r:Order | r.pending = True)',
    );
    const renamed = createPool(mutrosePool).update(
      poolDocuments(
        workspaceOf(
          result.modelText!,
          RESOURCES.map((r) => ({
            ...r,
            text: result.resources[r.path] ?? r.text,
          })),
        ),
      ),
    );
    expect(renamed.diagnostics).to.deep.equal([]);
    expect(
      renamed.references().filter((r) => !renamed.target(r)),
    ).to.deep.equal([]);
  });

  it('puts its problems in Problems: a model field’s on its element, a file’s where it is', () => {
    const support = poolSupport('project files', mutrosePool, definition);
    const host = { navigate: () => {}, applyEdits: () => null };
    const broken = RESOURCES.map((r) =>
      r.kind === 'configuration'
        ? { ...r, text: r.text.replace('"task_id": "AT3"', '"task_id": "AT9"') }
        : r,
    );
    support.setWorkspace!(workspaceOf(MODEL, broken), host);
    const ours = () =>
      serviceProblemsNow()
        .filter((p) => p.source === 'project files')
        .map((p) => [
          p.elementId ?? null,
          p.key ?? null,
          p.message.split(':')[0],
        ]);
    expect(ours()).to.deep.equal([
      [
        'AT3',
        'Params',
        'current_request is bound to no parameter of notifynurse',
      ],
      [null, null, 'configuration.json'],
    ]);
    expect(
      serviceProblemsNow().find(
        (p) => p.elementId === undefined && p.source === 'project files',
      )?.reveal?.document,
    ).to.equal('configuration/configuration.json');
    // fixed: cleared
    support.setWorkspace!(workspaceOf(MODEL), host);
    expect(ours()).to.deep.equal([]);
  });

  it('keeps a read-only editor focusable, for its keys, and refuses its edits (a behaviour of every read-only editor)', () => {
    const state = EditorState.create({
      doc: 'abc',
      extensions: readOnlyEditor(true),
    });
    // focusable: CodeMirror's editable stays on, so the keys (F12, Shift-F12, search) work
    expect(state.facet(EditorView.editable)).to.equal(true);
    expect(state.readOnly).to.equal(true);
    const dispatched: Transaction[] = [];
    const target = {
      state,
      dispatch: (tr: Transaction) => {
        dispatched.push(tr);
      },
    };
    // an editing command refuses
    expect(insertNewlineAndIndent(target)).to.equal(false);
    expect(dispatched).to.deep.equal([]);
    // an editable one doesn't
    const writable = EditorState.create({
      doc: 'abc',
      extensions: readOnlyEditor(false),
    });
    expect(
      insertNewlineAndIndent({ state: writable, dispatch: () => {} }),
    ).to.equal(true);
  });
});
