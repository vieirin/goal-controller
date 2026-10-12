'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { PoolEdit, PoolLocation } from '@goal-controller/facts';
import {
  ENGINE_DIALECTS,
  isDialectEngine,
} from '@/lib/workbench/engineDialects';
import {
  applyEdits,
  factsSession,
  modelChanges,
  modelField,
  notationSpans,
  spanOf,
} from '@/lib/workbench/facts';
import { notationDocument } from '@/lib/workbench/notationDocument';
import { setNodeProperty, setNodeText } from '@/lib/workbench/pistar';
import { resourceTabId } from '@/lib/workbench/projectResources';
import { useWorkbench } from './WorkbenchContext';

/**
 * The relational core's demo (goal-controller#61), mounted only behind its
 * flag: the open project's model and resources fed to the pool, and what
 * its services ask the workbench (show a location, write a rename's edits).
 */
export default function FactsBridge() {
  const wb = useWorkbench();
  const definition =
    isDialectEngine(wb.engine) && wb.mode === wb.engine
      ? ENGINE_DIALECTS[wb.engine]
      : null;
  const resources = useMemo(
    () =>
      wb.resourceSlots.flatMap((slot) =>
        slot.paths.flatMap((path) =>
          wb.resourceTexts[path] === undefined
            ? []
            : [{ kind: slot.kind, path, text: wb.resourceTexts[path]! }],
        ),
      ),
    [wb.resourceSlots, wb.resourceTexts],
  );
  useEffect(() => {
    factsSession.update(definition ?? null, wb.tree, resources);
  }, [definition, wb.tree, resources]);

  const latest = useRef(wb);
  latest.current = wb;
  useEffect(() => {
    factsSession.host = {
      navigate: (location: PoolLocation) => {
        const { tree, setModelTab, select } = latest.current;
        const field = modelField(location.document);
        if (!field) {
          latest.current.openProjectFile(location.document);
          factsSession.show(
            resourceTabId(location.document),
            location.from,
            location.to,
          );
          return;
        }
        const shown = factsSession.definition;
        if (!tree || !shown) return;
        setModelTab('notation');
        select(field.key, 'problems');
        const text = notationDocument(shown, tree).text;
        const range = spanOf(notationSpans(shown, tree, text), location);
        if (range) factsSession.show('notation', range.from, range.to);
      },
      apply: (edits: readonly PoolEdit[]) => {
        const { tree, text, setText, setResourceText, resourceTexts } =
          latest.current;
        // each resource's edits, in its text
        const byDocument = new Map<string, PoolEdit[]>();
        for (const edit of edits)
          if (!modelField(edit.document))
            byDocument.set(edit.document, [
              ...(byDocument.get(edit.document) ?? []),
              edit,
            ]);
        for (const [path, list] of byDocument)
          setResourceText(path, applyEdits(resourceTexts[path] ?? '', list));
        // the model's: each element's text and properties, as the inspector writes them
        if (!tree) return;
        const changes = modelChanges(tree, edits);
        if (!changes.length) return;
        const next = changes.reduce((model, change) => {
          let out =
            change.text === null
              ? model
              : setNodeText(model, change.iStarId, change.text);
          for (const [key, value] of change.properties)
            out = setNodeProperty(out, change.iStarId, key, value);
          return out;
        }, text);
        setText(next, 'inspector');
      },
    };
    return () => {
      factsSession.host = null;
      factsSession.update(null, null, []);
    };
  }, []);
  return null;
}
