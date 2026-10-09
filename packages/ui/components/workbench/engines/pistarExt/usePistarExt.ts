'use client';

import { useMemo, useRef } from 'react';
import { MODEL_NAMESPACE } from '@goal-controller/dialect';
import {
  modelDialect,
  modelExtensionOf,
  type ModelDialect,
} from '@/lib/workbench/dialects';
import { useWorkbench } from '../../WorkbenchContext';

/**
 * piStar-ext as the open model has it: the dialect with what the model adds
 * (its own constructs, groupers, stereotypes and tagged values). While the
 * model's additions can't be read (being edited, a name taken), the last ones
 * that could stay.
 */
export const usePistarExt = (): ModelDialect => {
  const { text } = useWorkbench();
  const additions = JSON.stringify(modelExtensionOf(text));
  const last = useRef<ModelDialect>(
    modelDialect('pistarext', { name: MODEL_NAMESPACE }),
  );
  return useMemo(() => {
    try {
      last.current = modelDialect('pistarext', JSON.parse(additions));
    } catch {
      // kept
    }
    return last.current;
  }, [additions]);
};
