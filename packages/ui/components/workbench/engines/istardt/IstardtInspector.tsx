'use client';

import DefinitionInspector from '../definition/DefinitionInspector';

/** iStar-DT's node editor: built from its definition (utility links and the actor's sets included). */
export default function IstardtInspector() {
  return <DefinitionInspector engine='istardt' />;
}
