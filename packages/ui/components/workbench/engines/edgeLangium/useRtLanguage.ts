'use client';

import type { LSPClient } from '@codemirror/lsp-client';
import { useEffect, useState } from 'react';
import { notationContext } from '@/lib/workbench/notation';
import { rtClient, sendRtContext } from '@/lib/workbench/rtLsp';
import { useWorkbench } from '../../WorkbenchContext';

/**
 * The page's RT language server client, kept up to date with the model: the
 * elements and the workbench's context variables (`rt/context`). Null until
 * mounted in the browser.
 */
export const useRtLanguage = (): LSPClient | null => {
  const { tree, variables } = useWorkbench();
  const [client, setClient] = useState<LSPClient | null>(null);
  useEffect(() => setClient(rtClient()), []);
  useEffect(() => {
    if (!client || !tree) return;
    sendRtContext(client, [tree, variables], () =>
      notationContext(
        tree,
        variables
          .filter((variable) => variable.kind === 'context')
          .map((variable) => variable.name),
      ),
    );
  }, [client, tree, variables]);
  return client;
};
