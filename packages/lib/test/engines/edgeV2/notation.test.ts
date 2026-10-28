/**
 * EdgeV2's Notation view validation of its mixed-operator rule
 * (goal-controller#502): `#` and `;` written at the same level without
 * a bracket of their own fail, the way an agent's edit through
 * set-properties would (ui/lib/workbench/agent/hostTools.ts's
 * validate-notation). EdgeV2's refinements are flat (`notation.grouping:
 * false`, goal-controller#502), so a group is never the fix: the
 * message says to add an intermediate goal, and a group anywhere is its
 * own error.
 */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import type { DefinitionContext } from '@goal-controller/dialect';
import { documentDiagnostics } from '@goal-controller/goal-language';
import { edgeV2 } from '../../../src/engines/edgeV2/definition';

const context: DefinitionContext = {
  elements: {
    G1: {
      kind: 'goal',
      children: ['G13', 'G14', 'G12'],
      properties: {},
      relation: 'and',
      construct: 'interleaved',
    },
    G13: { kind: 'goal', children: [], properties: {} },
    G14: { kind: 'goal', children: [], properties: {} },
    G12: { kind: 'goal', children: [], properties: {} },
  },
  variables: [],
};

describe('EdgeV2 in the Notation view: the mixed-operator rule', () => {
  it('fails a refinement that mixes `#` and `;`, saying it needs an intermediate goal (never a group)', () => {
    const messages = documentDiagnostics(
      edgeV2,
      'G1: Top [G13#G14;G12]\n  G13: A\n  G14: B\n  G12: C',
      context,
    ).map((d) => d.message);
    assert.deepStrictEqual(messages, [
      '`#` and `;` mixed in one refinement: EdgeV2 refinements are flat, so one needs an intermediate goal',
    ]);
  });

  it('fails a group anywhere: EdgeV2 refinements are flat, not even to resolve the mix above', () => {
    const messages = documentDiagnostics(
      edgeV2,
      'G1: Top [[G13#G14];G12]\n  G13: A\n  G14: B\n  G12: C',
      context,
    ).map((d) => d.message);
    assert.deepStrictEqual(messages, [
      'EdgeV2 refinements are flat: `[G13#G14];G12` has a nested group',
    ]);
  });
});
