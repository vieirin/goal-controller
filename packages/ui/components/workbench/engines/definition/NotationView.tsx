'use client';

import {
  ENGINE_DEFINITIONS,
  type DefinedEngine,
} from '@/lib/workbench/definitions';
import { useWorkbench } from '../../WorkbenchContext';
import NotationEditor from './NotationEditor';
import { useLanguageSupport } from './useLanguageSupport';

/** The whole model as the engine's notation (NotationEditor), on the engine's view of it. */
export default function NotationView({ engine }: { engine: DefinedEngine }) {
  const { tree } = useWorkbench();
  const support = useLanguageSupport(engine);
  return (
    <NotationEditor
      definition={ENGINE_DEFINITIONS[engine]}
      tree={tree}
      support={support}
      selectable
    />
  );
}
