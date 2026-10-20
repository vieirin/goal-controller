/**
 * KAOSTools' textual KAOS (`.kaos`) into goal-controller and back
 * (goal-controller#181): kaosprop's native file. The goal language serves
 * the parser (`@goal-controller/goal-language/formats`' `kaosLanguage`,
 * its grammar there); the reader is ./read.ts, the writer ./write.ts.
 */
export { kaosLanguage } from '@goal-controller/goal-language/formats';
export {
  identifierOf,
  KAOS_ENGINE,
  KAOS_EXPERT_ENGINE,
  KAOS_UNSUPPORTED_KEY,
  readKaos,
  type KaosReadOptions,
} from './read';
export { KAOS_LOSSY, writeKaos } from './write';
export { kaosNativeFile } from './native';
