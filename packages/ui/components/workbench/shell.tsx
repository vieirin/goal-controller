'use client';

import { createContext, useContext } from 'react';

/** Layout actions shared between the shell and the top bar. */
export type Shell = {
  explorerOpen: boolean;
  toggleExplorer: () => void;
  openDiagram: () => void;
};

export const ShellContext = createContext<Shell>({
  explorerOpen: true,
  toggleExplorer: () => undefined,
  openDiagram: () => undefined,
});

export const useShell = (): Shell => useContext(ShellContext);
