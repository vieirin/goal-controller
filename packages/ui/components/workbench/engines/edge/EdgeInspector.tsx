'use client';

import EdgeFamilyInspector, {
  type NotationOperator,
} from '../edgeFamily/EdgeFamilyInspector';
import { SelectedNode } from '../shared/inspector';

/** The notation operators Edge reads; a choice is a standalone `+`. */
const EDGE_OPERATORS: readonly NotationOperator[] = [
  { op: ';', construct: 'sequence' },
  { op: '#', construct: 'interleaved' },
  { op: '|', construct: 'alternative' },
  { op: '->', construct: 'degradation' },
  {
    op: '+',
    construct: 'choice',
    title: 'Choice (Edge notation: a standalone +)',
    notation: () => '+',
  },
];

export default function EdgeInspector() {
  return (
    <SelectedNode>
      {(node) => (
        <EdgeFamilyInspector
          key={node.id}
          node={node}
          engine='edge'
          operators={EDGE_OPERATORS}
        />
      )}
    </SelectedNode>
  );
}
