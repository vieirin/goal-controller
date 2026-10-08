import { expect } from 'chai';
import { EmptyFileSystem } from 'langium';
import { validationHelper } from 'langium/test';
import { relationMismatch } from '../src/constructs.js';
import type { Document } from '../src/generated/ast.js';
import { createRtServices } from '../src/lsp.js';

const { RtNotation } = createRtServices(EmptyFileSystem);
const validate = validationHelper<Document>(RtNotation);
const context = RtNotation.context.Context;

describe('notation construct vs refinement links', () => {
  afterEach(() => context.set(undefined));

  it('rejects an AND construct over OR links and vice versa', () => {
    expect(relationMismatch('sequence', 'or')).to.match(
      /^Sequence needs AND refinement links, but this goal is refined with OR links/,
    );
    expect(relationMismatch('choice', 'and')).to.match(/needs OR refinement/);
    expect(relationMismatch('interleaved', 'and')).to.equal(null);
    expect(relationMismatch('degradation', 'or')).to.equal(null);
    expect(relationMismatch(null, 'or')).to.equal(null);
  });

  it('marks the notation of an OR goal written as a sequence', async () => {
    context.set({
      elements: {
        G2: {
          kind: 'goal',
          children: ['G5', 'G6'],
          properties: {},
          relation: 'or',
          construct: 'sequence',
        },
        G5: { kind: 'goal', children: [], properties: {} },
        G6: { kind: 'goal', children: [], properties: {} },
      },
      variables: [],
    });
    const { diagnostics } = await validate(
      'G2: Track patient location [G5;G6]\n  G5: Manual\n  G6: Automatic',
    );
    expect(
      diagnostics.map((d) => [d.severity, d.message.split(' (')[0]]),
    ).to.deep.equal([
      [
        1,
        'Sequence needs AND refinement links, but this goal is refined with OR links',
      ],
    ]);
  });
});
