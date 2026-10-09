'use client';

import {
  ENGINE_DIALECTS,
  type DialectEngine,
} from '@/lib/workbench/engineDialects';
import { useWorkbench } from '../../WorkbenchContext';
import NotationEditor from './NotationEditor';
import { useLanguageSupport } from './useLanguageSupport';

/** The whole model as the engine's notation (NotationEditor), on the engine's view of it. */
export default function NotationView({ engine }: { engine: DialectEngine }) {
  const { tree } = useWorkbench();
  const support = useLanguageSupport(engine);
  return (
    <NotationEditor
      definition={ENGINE_DIALECTS[engine]}
      tree={tree}
      support={support}
      selectable
    />
  );
}
