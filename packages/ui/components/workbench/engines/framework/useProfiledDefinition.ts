'use client';

import { useMemo } from 'react';
import type { AnyDialect } from '@goal-controller/dialect';
import {
  vocabularyProfileOf,
  withVocabularyProfile,
} from '@goal-controller/lib';
import { parseModel } from '@/lib/workbench/dialects';

/**
 * A framework's dialect as the open model reads it: with the vocabulary
 * profile the model records (a CAIRIS model's `cairis`, goal-controller#192),
 * so its values are checked and offered as its source's; the dialect itself
 * for any other model. The same object while the profile is the same.
 */
export const useProfiledDefinition = (
  definition: AnyDialect,
  text: string,
): AnyDialect => {
  const profile = useMemo(() => {
    try {
      return vocabularyProfileOf(parseModel(text));
    } catch {
      return null;
    }
  }, [text]);
  return useMemo(
    () => withVocabularyProfile(definition, profile),
    [definition, profile],
  );
};
