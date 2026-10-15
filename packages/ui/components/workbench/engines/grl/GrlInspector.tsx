'use client';

import DefinitionInspector from '../definition/DefinitionInspector';

/** GRL's node editor: built from its definition (links and actors included, #107). */
export default function GrlInspector() {
  return <DefinitionInspector engine='grl' />;
}
