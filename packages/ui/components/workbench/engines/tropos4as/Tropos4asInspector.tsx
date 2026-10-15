'use client';

import DefinitionInspector from '../definition/DefinitionInspector';

/** Tropos4AS's node editor: built from its definition (goal types, conditions, the extension's kinds). */
export default function Tropos4asInspector() {
  return <DefinitionInspector engine='tropos4as' />;
}
