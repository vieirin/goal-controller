'use client';

import { setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { useEffect, useMemo, useRef, useState } from 'react';
import { setRangeMarks } from '@/lib/workbench/codemirror';
import { sourcePosition } from '@/lib/workbench/localProblems';
import { nodeRanges } from '@/lib/workbench/pistar';
import CodeEditor from './CodeEditor';
import { useSelection, useWorkbench } from './WorkbenchContext';
import { useShell } from './shell';

export default function SourceView() {
  const wb = useWorkbench();
  const { modelReadOnly } = useShell();
  const sel = useSelection();
  const { selected, selectOrigin, selectSeq } = sel;
  const { text, tree, problems, sourceLine } = wb;
  const latestSelected = useRef(selected);
  latestSelected.current = selected;
  const [view, setView] = useState<EditorView | null>(null);
  const latest = useRef(wb);
  latest.current = wb;

  const ranges = useMemo(
    () =>
      tree
        ? nodeRanges(text, [...tree.byIStarId.keys()])
        : new Map<string, [number, number]>(),
    [text, tree],
  );
  const rangesRef = useRef(ranges);
  rangesRef.current = ranges;

  // cursor inside a node's object → select that node
  const extensions = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        if (
          !update.selectionSet ||
          !update.transactions.some((tr) => tr.isUserEvent('select'))
        )
          return;
        const at = update.state.selection.main.head;
        let best: { iStarId: string; size: number } | null = null;
        for (const [iStarId, [from, to]] of rangesRef.current) {
          if (at >= from && at <= to && (!best || to - from < best.size))
            best = { iStarId, size: to - from };
        }
        const node = best
          ? latest.current.tree?.byIStarId.get(best.iStarId)
          : undefined;
        if (node && node.id !== latestSelected.current)
          latest.current.select(node.id, 'source');
      }),
    [],
  );

  // highlight (and reveal) the selected node's object
  useEffect(() => {
    if (!view) return;
    const node = selected ? tree?.nodes.get(selected) : undefined;
    const range = node ? ranges.get(node.iStarId) : undefined;
    view.dispatch({
      effects: [
        setRangeMarks.of(
          range
            ? [{ from: range[0], to: range[1], className: 'cm-node-range' }]
            : [],
        ),
        ...(range && selectOrigin !== 'source'
          ? [EditorView.scrollIntoView(range[0], { y: 'start', yMargin: 40 })]
          : []),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectSeq, ranges]);

  // problems as inline diagnostics
  useEffect(() => {
    if (!view) return;
    const doc = view.state.doc;
    const diagnostics: Diagnostic[] = [];
    for (const problem of problems) {
      const at = sourcePosition(problem);
      if (at && at.line <= doc.lines) {
        const line = doc.line(at.line);
        const from = Math.min(line.from + Math.max(0, at.column - 1), line.to);
        diagnostics.push({
          from,
          to: Math.max(from, line.to),
          severity: 'error',
          message: problem.message,
        });
        continue;
      }
      const node = problem.elementId
        ? tree?.nodes.get(problem.elementId)
        : undefined;
      const range = node ? ranges.get(node.iStarId) : undefined;
      if (range && range[1] <= doc.length) {
        const textAt = doc.sliceString(range[0], range[1]).indexOf('"text"');
        const from = textAt >= 0 ? range[0] + textAt : range[0];
        diagnostics.push({
          from,
          to: Math.min(doc.lineAt(from).to, range[1]),
          severity:
            problem.severity === 'error'
              ? 'error'
              : problem.severity === 'warning'
                ? 'warning'
                : 'info',
          message: problem.message,
        });
      }
    }
    view.dispatch(setDiagnostics(view.state, diagnostics));
  }, [view, problems, ranges, tree]);

  // "go to line" requests (from Problems)
  useEffect(() => {
    if (!view || !sourceLine) return;
    const doc = view.state.doc;
    const line = doc.line(Math.min(Math.max(1, sourceLine.line), doc.lines));
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
    });
    view.focus();
  }, [view, sourceLine]);

  return (
    <CodeEditor
      value={text}
      language='json'
      ariaLabel='Goal model source (piStar JSON)'
      onChange={(value) => wb.setText(value, 'source')}
      readOnly={modelReadOnly}
      extensions={extensions}
      onReady={setView}
    />
  );
}
