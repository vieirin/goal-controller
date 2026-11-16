/**
 * Edits typed in a real model's Notation document (goal-controller#518,
 * the two reviews of #528): each failing input the reviews give, the
 * second review's N1-N3, two ids swapped, NFR's and piStar-ext's created
 * elements. Each edit is read (`notationReading`), made to the model's text
 * (`applyNotationEdits`) and the model read back; the next edit is read
 * either against the text the model was written to again, or, as the
 * editor does, against the text as typed (`base`).
 */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  MISSING_END_ID_KEYS,
  WRITTEN_ID_KEY,
  type AnyDialect,
  type DocumentTree,
} from '@goal-controller/dialect';
import { goalView } from '@goal-controller/goal-tree';
import {
  notationDocument,
  notationReading,
  type DocumentBase,
  type NotationEdit,
} from '@goal-controller/goal-language';
import { kaos, nfr } from '../../src';
import {
  DIALECT_DEFINITIONS,
  dialectTree,
  parseModel,
} from '../../../ui/lib/workbench/dialects';
import { applyNotationEdits } from '../../../ui/lib/workbench/notationDocument';
import { ROOT } from './support/models';

type Framework = 'istar-2.0' | 'kaos' | 'nfr';
type AnyModel = ReturnType<typeof parseModel>;

const example = (file: string) => readFileSync(join(ROOT, file), 'utf8');

const newIds = () => {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`;
};

/** A model as the Notation view has it: its text, model, tree and document. */
type State = {
  text: string;
  model: AnyModel;
  tree: DocumentTree;
  doc: string;
  /** what the last edit was read into (the editor's next base) */
  base?: DocumentBase;
  edits: NotationEdit[];
};

const opener = (
  dialect: AnyDialect,
  mode: string,
  framework: Framework,
  own = false,
) => {
  const state = (text: string, edits: NotationEdit[] = []): State => {
    const model = parseModel(text, mode as never, framework);
    const tree = own ? dialectTree(model) : goalView(model as never, dialect);
    return {
      text,
      model,
      tree,
      doc: notationDocument(dialect, tree).text,
      edits,
    };
  };
  const ids = newIds();
  return {
    open: (file: string) => state(example(file)),
    /** `typed` read against `from` (its document, or `base`), made to its text */
    edit: (from: State, typed: string, base?: DocumentBase): State => {
      const reading = notationReading(dialect, typed, from.tree, {
        newId: ids,
        ...(base && { base }),
      });
      return {
        ...state(applyNotationEdits(from.text, reading.edits, from.tree)),
        edits: reading.edits,
        base: reading.base,
      };
    },
  };
};

const KAOS = kaos as unknown as AnyDialect;
const kaosModels = () => opener(KAOS, 'kaos', 'kaos');
const lines = (doc: string) => doc.split('\n');
const insertAfter = (doc: string, at: number, text: string) =>
  [...lines(doc).slice(0, at + 1), text, ...lines(doc).slice(at + 1)].join(
    '\n',
  );
const lineOf = (doc: string, pattern: RegExp) => {
  const at = lines(doc).findIndex((line) => pattern.test(line));
  expect(at, String(pattern)).to.be.greaterThan(-1);
  return at;
};
/** the piStar id of the element whose line shows `id` (its first characters) */
const uuidOf = (state: State, id: string): string => {
  const found = [...state.tree.nodes.values()].filter((node) =>
    node.iStarId.startsWith(id),
  );
  expect(found, id).to.have.length(1);
  return found[0]!.iStarId;
};
const named = (model: AnyModel, name: string) =>
  [...model.elements.values()].filter((element) => element.name === name);
const creates = (edits: readonly NotationEdit[]) =>
  edits.flatMap((edit) => ('create' in edit ? [edit.create] : []));
const removes = (edits: readonly NotationEdit[]) =>
  edits.filter((edit) => 'remove' in edit);

describe('edits typed in a model’s Notation document (#518 reviews)', () => {
  describe('mine-pump (KAOS)', () => {
    const FILE = 'examples/kaos/mine-pump/mine-pump.txt';
    const A_LINE =
      /^behavioral_goal a62a2c28: Avoid \[MinerInOverflowedMine\]$/;

    it('a line typed under an element line changes none of its properties (first review, 1)', () => {
      const { open, edit } = kaosModels();
      const start = open(FILE);
      const at = lineOf(start.doc, A_LINE);
      for (const typed of ['  behavioral_g', '  behavioral_goal'])
        expect(
          edit(start, insertAfter(start.doc, at, typed)).edits,
          typed,
        ).to.deep.equal([]);
      // a complete line: its element only
      const a = start.model.elements.get(uuidOf(start, 'a62a2c28'))!;
      const next = edit(
        start,
        insertAfter(start.doc, at, '  behavioral_goal X'),
      );
      expect(next.edits).to.have.length(1);
      expect(creates(next.edits)[0]!.text).to.equal('X');
      expect(next.model.elements.get(a.id)!.customProperties).to.deep.equal(
        a.customProperties,
      );
    });

    it('a new element line with its Description under A’s line: the new element’s, A’s untouched (N1)', () => {
      const { open, edit } = kaosModels();
      const start = open(FILE);
      const at = lineOf(start.doc, A_LINE);
      const a = start.model.elements.get(uuidOf(start, 'a62a2c28'))!;
      const typed = insertAfter(
        start.doc,
        at,
        'behavioral_goal X\n  Description newdesc',
      );
      const next = edit(start, typed);
      expect(next.edits).to.have.length(1);
      expect(creates(next.edits)[0]!.properties).to.deep.equal({
        Description: 'newdesc',
      });
      expect(next.model.elements.get(a.id)!.customProperties).to.deep.equal(
        a.customProperties,
      );
      const [x] = named(next.model, 'X');
      expect(x!.customProperties).to.deep.include({ Description: 'newdesc' });
      // the same text read again, as the editor keeps it: nothing more
      expect(edit(next, typed, next.base).edits).to.deep.equal([]);
      // A's Description line, changed where it is: still A's
      const changed = typed.replace(
        /\n {2}Description The objective function[^\n]*/,
        '\n  Description changed',
      );
      const third = edit(next, changed, next.base);
      expect(third.edits).to.deep.equal([
        { iStarId: a.id, key: 'Description', value: 'changed' },
      ]);
    });

    it('an id changed in place renames its element (first review, 3)', () => {
      const { open, edit } = kaosModels();
      const start = open(FILE);
      const a = uuidOf(start, 'a62a2c28');
      const next = edit(
        start,
        start.doc.replace(
          'behavioral_goal a62a2c28:',
          'behavioral_goal z62a2c28:',
        ),
      );
      expect(next.edits).to.deep.equal([
        { iStarId: a, key: WRITTEN_ID_KEY, value: 'z62a2c28' },
      ]);
      expect(next.model.elements.size).to.equal(start.model.elements.size);
      expect(next.tree.orphans).to.deep.equal([]);
    });

    it('a copied element line edits nothing (first review, 4)', () => {
      const { open, edit } = kaosModels();
      const start = open(FILE);
      const at = lineOf(start.doc, A_LINE);
      for (const after of [at, at + 3, lines(start.doc).length - 1])
        expect(
          edit(start, insertAfter(start.doc, after, lines(start.doc)[at]!))
            .edits,
        ).to.deep.equal([]);
    });
  });

  describe('kaos-welcome (KAOS)', () => {
    const FILE = 'examples/kaos/kaos-welcome.txt';
    const DP = /^\s*domain_property b7293d46: Internet connection available$/;

    it('an orphan is repaired by its line written again (first review, 2)', () => {
      const { open, edit } = kaosModels();
      const start = open(FILE);
      const uuid = uuidOf(start, 'b7293d46');
      const at = lineOf(start.doc, DP);
      const gone = edit(
        start,
        lines(start.doc)
          .filter((_, i) => i !== at)
          .join('\n'),
      );
      expect(gone.edits).to.deep.equal([{ remove: uuid }]);
      expect(gone.tree.orphans).to.have.length(2);
      const back = edit(gone, start.doc);
      expect(back.model.elements.has(uuid)).to.equal(true);
      expect(back.model.elements.size).to.equal(start.model.elements.size);
      expect(back.tree.orphans).to.deep.equal([]);
    });

    for (const [how, chained] of [
      ['the text written from the model each time', false],
      ['the text as typed, as the editor keeps it', true],
    ] as const)
      it(`an orphan of an element whose author wrote its id is repaired by its line (N2): ${how}`, () => {
        const { open, edit } = kaosModels();
        const start = open(FILE);
        const uuid = uuidOf(start, 'b7293d46');
        // renamed
        const renamedDoc = start.doc.replace(
          'domain_property b7293d46:',
          'domain_property net_up:',
        );
        const renamed = edit(start, renamedDoc);
        expect(renamed.edits).to.deep.equal([
          { iStarId: uuid, key: WRITTEN_ID_KEY, value: 'net_up' },
        ]);
        // its line removed: its links are orphans, which keep its id
        const from = chained ? renamedDoc : renamed.doc;
        const at = lineOf(from, /^\s*domain_property net_up: /);
        const removedDoc = lines(from)
          .filter((_, i) => i !== at)
          .join('\n');
        const gone = edit(
          renamed,
          removedDoc,
          chained ? renamed.base : undefined,
        );
        expect(gone.edits).to.deep.equal([
          { remove: uuid, writtenId: 'net_up' },
        ]);
        expect(gone.tree.orphans).to.have.length(2);
        const kept = [...gone.model.links.values()].filter(
          (link) => link.source === uuid || link.target === uuid,
        );
        expect(kept).to.have.length(2);
        for (const link of kept)
          expect(
            link.customProperties?.[
              MISSING_END_ID_KEYS[link.source === uuid ? 'source' : 'target']
            ],
          ).to.equal('net_up');
        // written again: the same element, its orphans repaired, nothing kept
        const back = edit(
          gone,
          chained
            ? renamedDoc
            : insertAfter(gone.doc, at - 1, lines(renamedDoc)[at]!),
          chained ? gone.base : undefined,
        );
        expect(creates(back.edits).map((c) => c.iStarId)).to.deep.equal([uuid]);
        expect(back.tree.orphans).to.deep.equal([]);
        expect(back.model.elements.size).to.equal(start.model.elements.size);
        expect(back.model.elements.get(uuid)).to.deep.include({
          name: 'Internet connection available',
        });
        expect(
          back.model.elements.get(uuid)!.customProperties?.[WRITTEN_ID_KEY],
        ).to.equal('net_up');
        for (const link of kept) {
          const now = back.model.links.get(link.id)!;
          expect(now.customProperties ?? {}).to.not.have.any.keys(
            MISSING_END_ID_KEYS.source,
            MISSING_END_ID_KEYS.target,
          );
        }
        // the model's own text reads back as it is
        expect(edit(back, back.doc).edits).to.deep.equal([]);
      });

    it('an id changed and a line added in one edit: one rename, one create, no remove (N3)', () => {
      const { open, edit } = kaosModels();
      const start = open(FILE);
      const reliability = uuidOf(start, '7857cb00');
      const at = lineOf(start.doc, /^softgoal 7857cb00: Reliability$/);
      for (const where of [at, at - 1]) {
        const typed = insertAfter(
          start.doc.replace('softgoal 7857cb00:', 'softgoal chg_1:'),
          where,
          'behavioral_goal NewOne',
        );
        const next = edit(start, typed);
        expect(removes(next.edits)).to.deep.equal([]);
        expect(next.edits.filter((e) => !('create' in e))).to.deep.equal([
          { iStarId: reliability, key: WRITTEN_ID_KEY, value: 'chg_1' },
        ]);
        expect(creates(next.edits).map((c) => c.text)).to.deep.equal([
          'NewOne',
        ]);
        expect(next.tree.orphans).to.deep.equal([]);
        expect(next.model.elements.size).to.equal(
          start.model.elements.size + 1,
        );
        expect(next.model.links.size).to.equal(start.model.links.size);
      }
    });

    it('two consecutive ids swapped: two renames, each element keeps its name and links', () => {
      const { open, edit } = kaosModels();
      const start = open(FILE);
      const first = uuidOf(start, '8c2734b4');
      const second = uuidOf(start, '1938d85d');
      const typed = start.doc
        .replace('8c2734b4:', '\0:')
        .replace('1938d85d:', '8c2734b4:')
        .replace('\0:', '1938d85d:');
      const next = edit(start, typed);
      expect(next.edits).to.deep.equal([
        { iStarId: first, key: WRITTEN_ID_KEY, value: '1938d85d' },
        { iStarId: second, key: WRITTEN_ID_KEY, value: '8c2734b4' },
      ]);
      expect(next.model.elements.get(first)!.name).to.equal(
        start.model.elements.get(first)!.name,
      );
      expect(next.tree.orphans).to.deep.equal([]);
      expect([...next.model.links.values()]).to.deep.equal([
        ...start.model.links.values(),
      ]);
      expect(next.doc).to.equal(typed);
      expect(edit(next, next.doc).edits).to.deep.equal([]);
    });
  });

  describe('NFR and piStar-ext: a line creates its element', () => {
    it('NFR: an NFR softgoal, an operationalization with its property, a claim', () => {
      const { open, edit } = opener(nfr as unknown as AnyDialect, 'nfr', 'nfr');
      const start = open('examples/nfr/nfr-welcome.txt');
      const typed = `${start.doc}\nnfr Performance\noperationalization op_1: Cache\n  Description keep answers\nclaim Measured`;
      const next = edit(start, typed);
      expect(removes(next.edits)).to.deep.equal([]);
      expect(
        creates(next.edits).map(({ kind, text, properties, writeId }) => ({
          kind,
          text,
          properties,
          written: writeId === null,
        })),
      ).to.deep.equal([
        {
          kind: 'nfr.NFR',
          text: 'Performance',
          properties: {},
          written: false,
        },
        {
          kind: 'nfr.Operationalization',
          text: 'Cache',
          properties: { [WRITTEN_ID_KEY]: 'op_1', Description: 'keep answers' },
          written: true,
        },
        { kind: 'nfr.Claim', text: 'Measured', properties: {}, written: false },
      ]);
      expect(next.model.elements.size).to.equal(start.model.elements.size + 3);
      expect(named(next.model, 'Cache')[0]!.customProperties).to.deep.include({
        Description: 'keep answers',
        [WRITTEN_ID_KEY]: 'op_1',
      });
      // the model's own text reads back as it is
      expect(edit(next, next.doc).edits).to.deep.equal([]);
    });

    it('piStar-ext: its own metamodel’s kinds', () => {
      const { open, edit } = opener(
        DIALECT_DEFINITIONS.pistarext,
        'pistarext',
        'istar-2.0',
        true,
      );
      const start = open('examples/pistar-ext/stereotypes-and-tags.txt');
      const word = lines(start.doc)
        .map(
          (line) =>
            /^\s*(?:<<[^>]*>>\s*)?(?:\{[^}]*\}\s*)?([a-z_]+) /.exec(line)?.[1],
        )
        .find((w) => w !== undefined && w !== 'actor')!;
      expect(word).to.be.a('string');
      const typed = `${start.doc}\n${word} written_1: Something new`;
      const next = edit(start, typed);
      expect(removes(next.edits)).to.deep.equal([]);
      expect(creates(next.edits)).to.have.length(1);
      expect(creates(next.edits)[0]).to.deep.include({ text: 'Something new' });
      expect(next.model.elements.size).to.equal(start.model.elements.size + 1);
      expect(edit(next, next.doc).edits).to.deep.equal([]);
    });
  });
});
