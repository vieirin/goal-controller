'use client';

import type { IstarExtension } from '@istar-ts/react';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

/**
 * GRL reads every iStar node kind (a softgoal is a quality) and its own
 * indicator and belief, which a GRL model declares in its metamodel block:
 * the whole palette, nothing taken out.
 */
export const GRL_PALETTE: readonly IstarExtension[] = [];

export default function GrlDiagram() {
  return <WorkbenchCanvas extensions={GRL_PALETTE} />;
}
