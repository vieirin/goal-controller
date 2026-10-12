/**
 * The relational core's services in an editor (goal-controller#61, behind
 * its flag): F12 or Mod-click goes to the definition, in any tab; Shift-F12
 * lists the references; F2 renames across files (an inline panel, not a
 * browser prompt); hover shows a name's kind and type; the pool's
 * diagnostics are underlined. An editor says how its positions map to the
 * pool's documents (a resource's tab is one; the Notation view shows many
 * model fields).
 */
import { forceLinting, linter, type Diagnostic } from '@codemirror/lint';
import {
  Prec,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import {
  EditorView,
  hoverTooltip,
  keymap,
  showPanel,
  ViewPlugin,
  type Panel,
} from '@codemirror/view';
import type { PoolLocation } from '@goal-controller/facts';
import { factsSession, modelField } from './facts';

export type Locator = {
  /** the pool's document and offset at a position of the editor */
  at(
    view: EditorView,
    position: number,
  ): { document: string; offset: number } | null;
  /** where a pool location is in the editor (null: not shown in it) */
  here(
    view: EditorView,
    location: PoolLocation,
  ): { from: number; to: number } | null;
};

/** A location as a person reads it: `G3 · Controls`, or the resource's path. */
const describe = (location: PoolLocation) => {
  const field = modelField(location.document);
  const text = factsSession.pool?.textOf(location.document) ?? '';
  const name = text.slice(location.from, location.to);
  if (field) return `${field.key} · ${field.field}: ${name}`;
  const line = text.slice(0, location.from).split('\n').length;
  return `${location.document}:${line}: ${name}`;
};

type PanelState =
  | { kind: 'references'; locations: PoolLocation[]; title: string }
  | {
      kind: 'rename';
      document: string;
      offset: number;
      name: string;
      refused?: string;
    }
  | null;

const setPanel = StateEffect.define<PanelState>();

const panelField = StateField.define<PanelState>({
  create: () => null,
  update: (value, transaction) => {
    for (const effect of transaction.effects)
      if (effect.is(setPanel)) return effect.value;
    // an edit closes a rename (its offset moved)
    return transaction.docChanged && value?.kind === 'rename' ? null : value;
  },
  provide: (field) =>
    showPanel.from(field, (value) =>
      value ? (view) => panelOf(view, value) : null,
    ),
});

const panelOf = (view: EditorView, state: NonNullable<PanelState>): Panel => {
  const dom = document.createElement('div');
  dom.className = 'cm-facts-panel';
  dom.style.cssText =
    'padding:4px 8px;font-size:12px;display:flex;flex-direction:column;gap:2px;max-height:30vh;overflow:auto';
  const close = () => view.dispatch({ effects: setPanel.of(null) });
  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;gap:8px;align-items:center;font-weight:600';
  const title = document.createElement('span');
  header.append(title);
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.style.marginLeft = 'auto';
  closeButton.onclick = close;
  header.append(closeButton);
  dom.append(header);
  if (state.kind === 'references') {
    title.textContent = state.title;
    for (const location of state.locations) {
      const item = document.createElement('button');
      item.textContent = describe(location);
      item.style.cssText =
        'text-align:left;font-family:monospace;padding:1px 4px';
      item.onclick = () => factsSession.navigate(location);
      dom.append(item);
    }
  } else {
    title.textContent = `Rename \`${state.name}\` in every file`;
    const form = document.createElement('form');
    form.style.cssText = 'display:flex;gap:6px';
    const input = document.createElement('input');
    input.value = state.name;
    input.setAttribute('aria-label', 'New name');
    input.style.cssText = 'font-family:monospace;flex:1;padding:1px 4px';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Rename';
    form.append(input, submit);
    form.onsubmit = (event) => {
      event.preventDefault();
      const result = factsSession.rename(
        state.document,
        state.offset,
        input.value.trim(),
      );
      view.dispatch({
        effects: setPanel.of(
          'refused' in result ? { ...state, refused: result.refused } : null,
        ),
      });
    };
    input.onkeydown = (event) => {
      if (event.key === 'Escape') close();
    };
    dom.append(form);
    if (state.refused) {
      const refused = document.createElement('div');
      refused.textContent = state.refused;
      refused.style.color = 'var(--color-danger, #c33)';
      dom.append(refused);
    }
    setTimeout(() => {
      input.focus();
      input.select();
    });
  }
  return { dom, top: false };
};

export const factsExtension = (locator: Locator): Extension => {
  const target = (
    view: EditorView,
    position = view.state.selection.main.head,
  ) => locator.at(view, position);
  const goToDefinition = (view: EditorView, position?: number) => {
    const at = target(view, position);
    const [definition] = at
      ? (factsSession.pool?.definitionAt(at.document, at.offset) ?? [])
      : [];
    if (definition) factsSession.navigate(definition);
    return !!definition;
  };
  return [
    panelField,
    // over the goal language's own keys (its F2 renames in the Notation view
    // only): a key falls through where the pool has no name
    Prec.high(
      keymap.of([
        { key: 'F12', run: (view) => goToDefinition(view) },
        {
          key: 'Shift-F12',
          run: (view) => {
            const at = target(view);
            const locations = at
              ? (factsSession.pool?.referencesAt(at.document, at.offset) ?? [])
              : [];
            if (!locations.length) return false;
            view.dispatch({
              effects: setPanel.of({
                kind: 'references',
                locations,
                title: `${locations.length} places: the definition first`,
              }),
            });
            return true;
          },
        },
        {
          key: 'F2',
          run: (view) => {
            const at = target(view);
            const pool = factsSession.pool;
            const id = at && pool?.idAt(at.document, at.offset);
            if (!at || !id) return false;
            view.dispatch({
              effects: setPanel.of({
                kind: 'rename',
                document: at.document,
                offset: at.offset,
                name: pool!.nameOf(id),
              }),
            });
            return true;
          },
        },
        {
          key: 'Escape',
          run: (view) => {
            if (!view.state.field(panelField)) return false;
            view.dispatch({ effects: setPanel.of(null) });
            return true;
          },
        },
      ]),
    ),
    EditorView.domEventHandlers({
      mousedown: (event, view) => {
        if (!(event.metaKey || event.ctrlKey)) return false;
        const position = view.posAtCoords({
          x: event.clientX,
          y: event.clientY,
        });
        return position !== null && goToDefinition(view, position);
      },
    }),
    hoverTooltip((view, position) => {
      const at = locator.at(view, position);
      const hover = at && factsSession.pool?.hoverAt(at.document, at.offset);
      if (!at || !hover) return null;
      return {
        pos: position,
        create: () => {
          const dom = document.createElement('div');
          dom.style.cssText = 'padding:2px 6px;font-size:12px';
          dom.textContent = `${hover.label} ${hover.name}${hover.type ? `: ${hover.type}` : ''}${hover.detail ? ` (${hover.detail})` : ''} — ${describe(hover.location).split(':')[0]}`;
          return { dom };
        },
      };
    }),
    linter(
      (view) =>
        factsSession.diagnostics.flatMap((d): Diagnostic[] => {
          const range = locator.here(view, d.location);
          return range
            ? [
                {
                  ...range,
                  severity: d.severity,
                  message: d.message,
                  source: 'facts',
                },
              ]
            : [];
        }),
      { delay: 100 },
    ),
    // the pool changed (another tab's edit): lint again
    ViewPlugin.define((view) => {
      const unsubscribe = factsSession.subscribe(() =>
        queueMicrotask(() => view.dom.isConnected && forceLinting(view)),
      );
      return { destroy: () => void unsubscribe() };
    }),
  ];
};
