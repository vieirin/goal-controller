'use client';

import type { IstarExtension } from '@istar-ts/react';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

/**
 * STS-ml reads iStar's roles, agents, goals and resources (its documents),
 * and its own information, events and relationships, which a model
 * declares in its metamodel block: the whole palette, nothing taken out.
 * Its views (social, information, authorisation) filter the canvas.
 */
export const STS_PALETTE: readonly IstarExtension[] = [];

export default function StsDiagram() {
  return <WorkbenchCanvas extensions={STS_PALETTE} />;
}
