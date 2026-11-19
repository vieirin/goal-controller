'use client';

import type { GoalViewNode } from '@goal-controller/goal-tree';
import { DEFAULT_ELEMENT_FILL } from '@goal-controller/lib';
import type { TransformEngine } from '@/lib/types';
import {
  NameField,
  NodeColorField,
  NodeHeader,
  PropertiesField,
  QualificationField,
  RefinementField,
  SelectedNode,
  VariablesField,
} from './inspector';

/**
 * The node editor of an engine without a definition (SLEEC): it reads no
 * execution notation and has no property specs, so names, links, properties.
 */
function PlainNodeInspector({
  node,
  engine,
}: {
  node: GoalViewNode;
  engine: TransformEngine;
}) {
  return (
    <div className='space-y-4 p-4'>
      <NodeHeader node={node} />
      <NameField node={node} />
      <RefinementField node={node} />
      <QualificationField node={node} />
      <NodeColorField node={node} fallback={DEFAULT_ELEMENT_FILL} />
      <PropertiesField node={node} engine={engine} />
      <VariablesField node={node} />
    </div>
  );
}

export default function PlainInspector({
  engine,
}: {
  engine: TransformEngine;
}) {
  return (
    <SelectedNode>
      {(node) => (
        <PlainNodeInspector key={node.id} node={node} engine={engine} />
      )}
    </SelectedNode>
  );
}
