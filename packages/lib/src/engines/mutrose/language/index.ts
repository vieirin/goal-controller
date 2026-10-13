/**
 * MutRoSe's language (./mutrose.langium): its property values read with
 * their grammar, names and ranges as plain data.
 */
export * from './read';
// its parser services, for the pool's `langium(…)` (the goal model's declaration)
export { mutroseServices } from './module';
