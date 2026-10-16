'use client';

import DefinitionInspector from '../definition/DefinitionInspector';

/** STS-ml's node and link editor: built from its definition (security needs, authorisations, the extension's kinds). */
export default function StsInspector() {
  return <DefinitionInspector engine='sts' />;
}
