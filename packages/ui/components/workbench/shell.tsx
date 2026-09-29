'use client';

import { createContext, useContext } from 'react';

/** Layout actions shared between the shell and the top bar. */
export type Shell = {
  explorerOpen: boolean;
  toggleExplorer: () => void;
  /** The model column alone: PRISM output and side bar collapsed. */
  modelFullscreen: boolean;
  toggleModelFullscreen: () => void;
  /** View the model without editing it: no diagram palette, a summary Inspector, read-only source. */
  modelReadOnly: boolean;
  toggleModelReadOnly: () => void;
  /** The plain @istar-ts/react editor, as piStar: default palette, no extensions, the model alone. */
  pistarMode: boolean;
  togglePistarMode: () => void;
};

export const ShellContext = createContext<Shell>({
  explorerOpen: true,
  toggleExplorer: () => undefined,
  modelFullscreen: false,
  toggleModelFullscreen: () => undefined,
  modelReadOnly: false,
  toggleModelReadOnly: () => undefined,
  pistarMode: false,
  togglePistarMode: () => undefined,
});

export const useShell = (): Shell => useContext(ShellContext);
