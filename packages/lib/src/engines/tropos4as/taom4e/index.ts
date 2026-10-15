/**
 * TAOM4E's `.tropos` (goal-controller#136 item 4, #144 item 3): its
 * reader, its writer, and the native file they make.
 */
export { readTaom4e, type Taom4eContext } from './read';
export { writeTaom4e } from './write';
export { canonicalTaom4e, taom4eNativeFile, TAOM4E_LOSSY } from './native';
