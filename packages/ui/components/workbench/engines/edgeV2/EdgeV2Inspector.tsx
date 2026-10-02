'use client';

import EdgeFamilyInspector, {
  type NotationOperator,
} from '../edgeFamily/EdgeFamilyInspector';
import { SelectedNode } from '../shared/inspector';

/** The notation operators EdgeV2 reads: Edge's, plus any order (+) and choice (?). */
const EDGEV2_OPERATORS: readonly NotationOperator[] = [
  { op: ';', construct: 'sequence' },
  { op: '+', construct: 'anyOrder' },
  { op: '#', construct: 'interleaved' },
  { op: '|', construct: 'alternative' },
  { op: '?', construct: 'choice' },
  { op: '->', construct: 'degradation' },
];

export default function EdgeV2Inspector() {
  return (
    <SelectedNode>
      {(node) => (
        <EdgeFamilyInspector
          key={node.id}
          node={node}
          engine='edgev2'
          operators={EDGEV2_OPERATORS}
        />
      )}
    </SelectedNode>
  );
}
