/**
 * A workbench component, as lib's tests see it (tsconfig.test.json's paths):
 * the UI modules they read reference components by lazy import only (the
 * engine registry's palettes and inspectors, packages/ui's
 * lib/workbench/engineDialects.ts), which they never load.
 */
declare const component: any;
export default component;
