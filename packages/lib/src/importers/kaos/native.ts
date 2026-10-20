/**
 * `.kaos` as kaosprop's native file (goal-controller#143's pattern,
 * goal-controller#181): read into the model, written from it as it is
 * edited. An `import` reads the project's files of that name.
 */
import type { NativeFileDefinition } from '@goal-controller/dialect';
import { kaosLanguage } from '@goal-controller/goal-language/formats';
import { readKaos } from './read';
import { KAOS_LOSSY, writeKaos } from './write';

export const kaosNativeFile: NativeFileDefinition = {
  label: 'KAOSTools',
  extensions: ['.kaos'],
  format: 'text',
  read: (text, { modelName, projectResources = {} }) =>
    readKaos(text, {
      modelName,
      files: Object.assign({}, ...Object.values(projectResources)),
    }),
  write: (model, { modelName }) => writeKaos(model, { modelName }),
  lossy: KAOS_LOSSY,
  language: kaosLanguage,
};
