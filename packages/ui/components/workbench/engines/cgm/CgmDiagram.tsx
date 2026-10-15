'use client';

import type { IstarExtension } from '@istar-ts/react';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

/**
 * Contextual goal models read iStar's goals, tasks, resources and softgoals
 * (qualities), and their own contexts, statements, facts and cost
 * relations, which a model declares in its metamodel block: the whole
 * palette, nothing taken out.
 */
export const CGM_PALETTE: readonly IstarExtension[] = [];

export default function CgmDiagram() {
  return <WorkbenchCanvas extensions={CGM_PALETTE} />;
}
