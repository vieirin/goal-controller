/**
 * The workbench's project manager: what a project is (its manifest), where it
 * is kept (its stores) and what was worked on last (Recent). No React, no
 * workbench state, no model library and no engines; the rest of the UI uses
 * it through this file only.
 */
export * from './manifest';
export * from './embedded';
export * from './store';
export * from './open';
export * from './recent';
export * from './zip';
export * from './slots';
export * from './resources';
export * from './handles';
export { fileStore } from './stores/file';
export {
  directoryStore,
  type DirectoryHandleLike,
  type FileHandleLike,
} from './stores/directory';
export { opfsStore, opfsProjects } from './stores/opfs';
export { githubStore, EXAMPLES_REPO } from './stores/github';
