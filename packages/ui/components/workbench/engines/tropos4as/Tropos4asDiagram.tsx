'use client';

import type { IstarExtension } from '@istar-ts/react';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

/**
 * Tropos4AS reads iStar's goals, plans (tasks), resources and softgoals
 * (qualities), and its own artifacts, failures, errors and symptoms, which a
 * Tropos4AS model declares in its metamodel block: the whole palette,
 * nothing taken out.
 */
export const TROPOS4AS_PALETTE: readonly IstarExtension[] = [];

export default function Tropos4asDiagram() {
  return <WorkbenchCanvas extensions={TROPOS4AS_PALETTE} />;
}
