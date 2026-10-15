'use client';

import DefinitionInspector from '../definition/DefinitionInspector';

/** The contextual goal models' node editor: built from their definition (contexts, costs, the extension's kinds). */
export default function CgmInspector() {
  return <DefinitionInspector engine='cgm' />;
}
