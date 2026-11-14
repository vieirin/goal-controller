/**
 * What a Notation document's edits do to the model (goal-controller#518),
 * without the editor: an element a line adds is created in the actor of
 * the line above it, one whose line is gone is removed with its links kept
 * (orphans), a line names its element by its id (a written one, or the
 * first characters of its piStar id); piStar-ext's lines too; the editor
 * completes kinds' words.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnyDialect } from '@goal-controller/dialect';
import { goalView } from '@goal-controller/goal-tree';
import { currentCompletions, startCompletion } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';
import {
  DIALECT_DEFINITIONS,
  dialectTree,
  parseModel,
} from '@/lib/workbench/dialects';
import { ENGINE_DIALECTS } from '@/lib/workbench/engineDialects';
import { FRAMEWORK_DIALECTS } from '@/lib/workbench/frameworkModes';
import { localLanguageSupport } from '@/lib/workbench/languageSupport';
import {
  applyNotationEdits,
  elementOfLine,
  lineKeys,
  notationDocument,
  notationEditOperations,
  notationEdits,
  withoutElements,
  writtenIdChanges,
} from '@/lib/workbench/notationDocument';

const EXAMPLES = join(__dirname, '../../../../examples');
const ISTAR = readFileSync(join(EXAMPLES, 'edge/simpleChoice.txt'), 'utf8');
const KAOS_WELCOME = readFileSync(
  join(__dirname, 'fixtures/kaos-welcome.txt'),
  'utf8',
);
const RA = readFileSync(
  join(EXAMPLES, 'pistar-ext/iStar4RationalAgents.txt'),
  'utf8',
);
const edgev2 = ENGINE_DIALECTS.edgev2;
const kaos: AnyDialect = FRAMEWORK_DIALECTS.kaos;
const ids = (() => {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`;
})();

describe('creating and removing elements from the text (#518)', () => {
  it('creates a new line’s element in the actor of the line above, as text and as operations', () => {
    const model = parseModel(ISTAR);
    const tree = goalView(model as never, edgev2);
    const { text } = notationDocument(edgev2, tree);
    const edited = text.replace(
      '    task T2: Task',
      '    task T2: Task\n  goal G9: Another goal',
    );
    const edits = notationEdits(edgev2, edited, tree, { newId: ids });
    const [create] = edits.flatMap((e) => ('create' in e ? [e.create] : []));
    expect(create).toMatchObject({
      kind: 'istar.Goal',
      text: 'G9: Another goal',
      writeId: null,
    });
    const actor = [...model.elements.values()].find(
      (e) => e.kind === 'istar.Actor',
    )!;
    const [operation] = notationEditOperations(edits, { model, tree });
    expect(operation).toMatchObject({
      kind: 'createNode',
      elementTypeId: 'istar.Goal',
      containerId: actor.id,
      args: { id: create!.iStarId, name: 'G9: Another goal' },
    });
    const next = parseModel(applyNotationEdits(ISTAR, edits, tree));
    expect(next.elements.get(create!.iStarId)).toMatchObject({
      name: 'G9: Another goal',
      parent: actor.id,
    });
    // and the text read again names it: nothing more to do
    expect(
      notationEdits(edgev2, edited, goalView(next as never, edgev2)),
    ).toEqual([]);
  });

  it('places two new elements apart, each on the paper where its kind may be', () => {
    const model = parseModel(KAOS_WELCOME);
    const tree = goalView(model as never, kaos);
    const { text } = notationDocument(kaos, tree);
    const edits = notationEdits(
      kaos,
      `${text}\nsoftgoal One\nsoftgoal Two`,
      tree,
      { newId: ids },
    );
    const operations = notationEditOperations(edits, { model, tree });
    expect(operations.map((op) => op.kind)).toEqual([
      'createNode',
      'createNode',
    ]);
    const [one, two] = operations as { location: unknown }[];
    expect(one).not.toHaveProperty('containerId');
    expect(one!.location).not.toEqual(two!.location);
  });

  it('removes an element whose line is gone, its links kept: an orphan in the view', () => {
    const model = parseModel(KAOS_WELCOME);
    const tree = goalView(model as never, kaos);
    const backup = [...model.elements.values()].find(
      (e) => e.name === 'Backup',
    )!;
    const file = withoutElements(model, new Set([backup.id]));
    expect(JSON.stringify(file)).not.toContain(`"id":"${backup.id}"`);
    expect(file.links).toEqual(
      (JSON.parse(KAOS_WELCOME) as { links: unknown[] }).links,
    );
    const text = applyNotationEdits(KAOS_WELCOME, [{ remove: backup.id }]);
    const next = parseModel(text);
    expect(next.elements.has(backup.id)).toBe(false);
    expect([...next.links.keys()]).toEqual([...model.links.keys()]);
    const orphans = goalView(next as never, kaos).orphans;
    expect(orphans.length).toBeGreaterThan(0);
    expect(orphans.every((o) => o.missing.includes(backup.id))).toBe(true);
    // as an operation: the model without it, its metamodel block as the model has it
    expect(
      notationEditOperations([{ remove: backup.id }], { model, tree }),
    ).toEqual([
      {
        kind: 'istar.replaceModel',
        model: file,
        fileMetamodel: false,
      },
    ]);
  });

  it('an element of a removed actor that stays goes on the paper', () => {
    const model = parseModel(ISTAR);
    const actor = [...model.elements.values()].find(
      (e) => e.kind === 'istar.Actor',
    )!;
    const inner = [...model.elements.values()].filter(
      (e) => e.parent === actor.id,
    );
    const file = withoutElements(model, new Set([actor.id]));
    expect(file.actors).toEqual([]);
    expect(file.orphans?.map((o) => o.id)).toEqual(inner.map((e) => e.id));
  });

  it('needs the live model to create or remove', () => {
    expect(() => notationEditOperations([{ remove: 'x' }])).toThrow();
  });
});

describe('a line’s element, by its id (#518)', () => {
  it('names an element without an id of its own by its piStar id’s first characters', () => {
    const model = parseModel(KAOS_WELCOME);
    const tree = goalView(model as never, kaos);
    const lines = notationDocument(kaos, tree).text.split('\n');
    const reliability = [...model.elements.values()].find(
      (e) => e.name === 'Reliability',
    )!;
    const at = lines.indexOf(
      `softgoal ${reliability.id.slice(0, 8)}: Reliability`,
    );
    expect(lineKeys(kaos, lines, tree)[at]).toBe(reliability.id);
    // a property line under it is its
    expect(elementOfLine(kaos, lines, at + 1, tree)).toBe(reliability.id);
    // a new line names none, nor do the lines under it
    const added = [...lines.slice(0, at), 'softgoal Fresh', '  Category x'];
    expect(elementOfLine(kaos, added, at + 1, tree)).toBeNull();
  });

  it('writes the id a created element shows on its line, found where it was typed', () => {
    const read = 'softgoal A\n  Category x\nsoftgoal  B\nsoftgoal';
    const now = `typed above\n${read}`;
    const create = (line: number, writeId: string) => ({
      create: {
        iStarId: `${writeId}-x`,
        kind: 'kaos.Softgoal',
        text: '',
        properties: {},
        after: null,
        line,
        writeId,
      },
    });
    const changes = writtenIdChanges(kaos, read, now, [
      create(0, 'aaaaaaaa'),
      create(2, 'bbbbbbbb'),
      create(3, 'cccccccc'),
    ]);
    const written = [...changes]
      .reverse()
      .reduce(
        (text, { from, insert }) =>
          text.slice(0, from) + insert + text.slice(from),
        now,
      );
    expect(written).toBe(
      'typed above\nsoftgoal aaaaaaaa: A\n  Category x\nsoftgoal  bbbbbbbb: B\nsoftgoal cccccccc: ',
    );
  });
});

describe('piStar-ext’s lines (#518)', () => {
  it('split a written id off its name, and print `kind id: name`', () => {
    const json = JSON.parse(RA);
    const robot = json.actors[0];
    robot.nodes[0].text = `deliver: ${robot.nodes[0].text}`;
    const model = parseModel(JSON.stringify(json), 'pistarext');
    const tree = dialectTree(model);
    const node = tree.nodes.get(robot.nodes[0].id)!;
    expect(node).toMatchObject({ id: 'deliver', hasId: true });
    expect(node.name).toBe(robot.nodes[0].text.slice('deliver: '.length));
    const lines = notationDocument(DIALECT_DEFINITIONS.pistarext, tree)
      .text.split('\n')
      .map((line) => line.trim());
    expect(lines.some((l) => l.endsWith(' deliver: Deliver sample'))).toBe(
      true,
    );
    const other = tree.nodes.get(robot.nodes[1].id)!;
    expect(other).toMatchObject({ id: other.iStarId, hasId: false });
    expect(
      lines.some((l) => l.includes(` ${other.iStarId.slice(0, 8)}: `)),
    ).toBe(true);
  });

  it('carry the links one of whose ends the model lacks, as orphans', () => {
    const json = JSON.parse(RA);
    const robot = json.actors[0];
    const gone = robot.nodes.pop();
    const model = parseModel(JSON.stringify(json), 'pistarext');
    const orphans = dialectTree(model).orphans ?? [];
    const touching = (
      json.links as { source: string; target: string }[]
    ).filter((l) => l.source === gone.id || l.target === gone.id).length;
    expect(touching).toBeGreaterThan(0);
    expect(orphans).toHaveLength(touching);
    expect(orphans.every((o) => o.missing.includes(gone.id))).toBe(true);
  });
});

describe('the Notation editor completes kinds’ words (#518)', () => {
  it('offers the kinds’ words at a line’s head, through the local language support', async () => {
    Object.assign(Range.prototype, {
      getClientRects: () => [],
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    });
    const support = localLanguageSupport(kaos, {});
    const doc = 'softgoal 7857cb00: Reliability\n  beh';
    const view = new EditorView({
      state: EditorState.create({
        doc,
        selection: { anchor: doc.length },
        extensions: support.documentExtension('file:///completion.notation'),
      }),
      parent: document.body,
    });
    startCompletion(view);
    await vi.waitFor(() =>
      expect(currentCompletions(view.state).map((c) => c.label)).toContain(
        'behavioral_goal',
      ),
    );
    view.destroy();
  });
});
