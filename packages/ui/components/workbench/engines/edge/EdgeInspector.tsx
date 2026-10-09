'use client';

import DefinitionInspector from '../definition/DefinitionInspector';

/** Edge's node editor: built from its definition (operators incl. the standalone choice). */
export default function EdgeInspector() {
  return <DefinitionInspector engine='edge' />;
}
