/**
 * The formats a dialect's files are written in, read and written with where
 * each part is (goal-controller#59, #143): XML and EMF XMI (read, written,
 * compared), JSON, and a dialect's own textual language over Langium
 * (`defineLanguage`). Generic: no format here knows a metamodel, a
 * dialect or an engine; an engine's importer or native file maps them.
 */
export * from './xml.js';
export * from './xmi.js';
export * from './json.js';
export * from './language.js';
