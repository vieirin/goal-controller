'use client';

import { RT_OPERATORS } from '@goal-controller/rt-language/constructs';
import EdgeFamilyInspector from '../edgeFamily/EdgeFamilyInspector';
import { SelectedNode } from '../shared/inspector';

export default function EdgeV2Inspector() {
  return (
    <SelectedNode>
      {(node) => (
        <EdgeFamilyInspector
          key={node.id}
          node={node}
          engine='edgev2'
          operators={RT_OPERATORS}
        />
      )}
    </SelectedNode>
  );
}
