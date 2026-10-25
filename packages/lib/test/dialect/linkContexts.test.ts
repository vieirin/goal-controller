/**
 * A `context` assertion on links, resolving an extension's kind
 * (goal-controller#152 item 4), through the view and the workbench's
 * React-free modules, on #152's toy (test/engines/variants/toy.ts): link
 * lines on refinement, contribution and dependency links are written, read
 * back and validated; a contribution's to a quality the dialect doesn't list
 * and a dependency's to its dependum name their targets.
 */
import { expect } from 'chai';
import { parsePistar } from '@istar-ts/core';
import { goalView } from '@goal-controller/goal-tree';
import {
  checkContextOf,
  documentDiagnostics,
  notationContextOf,
} from '@goal-controller/goal-language';
import { situated } from '../engines/variants/toy';
import { SITUATED_MODEL } from '../engines/variants/toyModel';
import {
  notationDocument,
  notationEdits,
} from '../../../ui/lib/workbench/notationDocument';

/** The toy model, its dependency on Bob guarded by C2. */
const MODEL = (() => {
  const model = JSON.parse(SITUATED_MODEL);
  model.links.find((l: { id: string }) => l.id === 'd1').customProperties = {
    context: 'C2',
  };
  return JSON.stringify(model);
})();

const view = (text = MODEL) =>
  goalView(parsePistar(text, { fileMetamodel: true }), situated);

const messages = (doc: string) => {
  const tree = view();
  return documentDiagnostics(
    situated,
    doc,
    notationContextOf(situated, { tree, variables: [] }),
  ).map((d) => [doc.slice(d.from, d.to), d.message]);
};

describe('a context on links (#152)', () => {
  const { text } = notationDocument(situated, view());

  it('writes each link’s context as a link line under its source', () => {
    expect(text).to.include('G1: Serve\n  context C1 | C2');
    expect(text).to.include('  link G1 {context = C2}');
    expect(text).to.include('  link G2 {context = !C1}');
    // a contribution to a quality the dialect doesn't list, and a dependency
    expect(text).to.include('link Q1 {context = C1}');
    expect(text).to.include('link G5 {context = C2}');
  });

  it('reads the document back as it is, every target known', () => {
    expect(messages(text)).to.deep.equal([]);
    expect(notationEdits(situated, text, view())).to.deep.equal([]);
  });

  it('maps an edited context back to its link, the dependency’s too', () => {
    const edited = text
      .replace('link G5 {context = C2}', 'link G5 {context = C1 & !C2}')
      .replace('link Q1 {context = C1}', 'link Q1 {context = C2}');
    expect(notationEdits(situated, edited, view())).to.deep.equal([
      { link: 'd1', key: 'context', value: 'C1 & !C2' },
      { link: 'k1', key: 'context', value: 'C2' },
    ]);
  });

  it('reports a context that names no context of the model', () => {
    expect(
      messages(
        text.replace('link G5 {context = C2}', 'link G5 {context = C9}'),
      ),
    ).to.deep.equal([['C9', 'C9 is not a situ.Context of this model']]);
  });

  it('gives a check the link, its target the dependum', () => {
    const check = checkContextOf(
      notationContextOf(situated, { tree: view(), variables: [] }),
      'T1',
    );
    expect(check.readLink?.('d1')).to.include({ source: 'T1', target: 'G5' });
    expect(check.readElement?.('G5')).to.include({
      kind: 'goal',
      name: 'Fetched',
    });
  });
});
