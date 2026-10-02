'use client';

import type { IstarExtension } from '@istar-ts/react';
import { problemBadges, rtNumbering } from '../shared/extensions';
import WorkbenchCanvas from '../shared/WorkbenchCanvas';

/** SLEEC reads the whole iStar palette, several actors included; names carry RT ids. */
const SLEEC_EXTENSIONS: readonly IstarExtension[] = [
  problemBadges,
  rtNumbering,
];

export default function SleecDiagram() {
  return <WorkbenchCanvas extensions={SLEEC_EXTENSIONS} />;
}
