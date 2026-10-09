'use client';

import type { GoalViewNode } from '@goal-controller/goal-tree';
import { DEFAULT_ELEMENT_FILL } from '@goal-controller/lib';
import {
  NameField,
  NodeColorField,
  NodeHeader,
  PropertiesField,
  QualificationField,
  RefinementField,
  SelectedNode,
  VariablesField,
} from '../shared/inspector';

/** SLEEC reads no execution notation, and has no property specs: names, links, properties. */
function SleecNodeInspector({ node }: { node: GoalViewNode }) {
  return (
    <div className='space-y-4 p-4'>
      <NodeHeader node={node} />
      <NameField node={node} />
      <RefinementField node={node} />
      <QualificationField node={node} />
      <NodeColorField node={node} fallback={DEFAULT_ELEMENT_FILL} />
      <PropertiesField node={node} engine='sleec' />
      <VariablesField node={node} />
    </div>
  );
}

export default function SleecInspector() {
  return (
    <SelectedNode>
      {(node) => <SleecNodeInspector key={node.id} node={node} />}
    </SelectedNode>
  );
}
