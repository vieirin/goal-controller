/**
 * A definition pool as a language support (goal-controller#59): an engine's
 * pool (lib's `definitionPool`), served in the page to every tab of its
 * project, the Notation view, the inspector's fields and each resource's
 * own tab alike. It gives each editor hover, go-to-definition (F12, or
 * Mod-click), find references (Shift-F12), rename (F2), completion and the
 * checks across files; it opens the tab a definition is in through its host.
 */
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import {
  EditorState,
  Prec,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  hoverTooltip,
  keymap,
  showPanel,
  ViewPlugin,
  type DecorationSet,
  type Panel,
} from '@codemirror/view';
import type { AnyDialect } from '@goal-controller/dialect';
import {
  completionsAt,
  createPool,
  definitionAt,
  hoverAt,
  modelField,
  referencesAt,
  renameEdits,
  symbolAt,
  type PoolDiagnostic,
  type PoolEdit,
  type PoolIndex,
  type PoolLocation,
  type PoolRegistration,
} from '@goal-controller/lib';
import { publishDiagnostics } from './diagnosticsStore';
import type { LanguageSupport } from './languageSupport';
import {
  notationPosition,
  notationRange,
  poolDocuments,
  type PoolWorkspace,
} from './poolDocuments';
import type { Problem } from './types';

export type { PoolWorkspace } from './poolDocuments';

/** What a pool's editors ask of the workbench. */
export type PoolHost = {
  /** show a location: open its tab, select its range */
  navigate(location: PoolLocation): void;
  /** apply a rename's edits, to the model and to the resources; why not, when it can't */
  applyEdits(edits: readonly PoolEdit[]): string | null;
};

/** How an editor's text maps onto the pool: its position's, and a location's range in it. */
type DocumentMap = {
  position(
    state: EditorState,
    offset: number,
  ): { document: string; offset: number } | null;
  range(
    state: EditorState,
    location: PoolLocation,
  ): { from: number; to: number } | null;
};

const refreshed = StateEffect.define<null>();

/** One line on where a location is, for a list or a hover. */
const placeOf = (
  location: PoolLocation,
  texts: (path: string) => string | undefined,
) => {
  const field = modelField(location.document);
  if (field) return `${field.element} ${field.field}`;
  const text = texts(location.document) ?? '';
  const line = text.slice(0, location.from).split('\n').length;
  return `${location.document.split('/').pop()}:${line}`;
};

/**
 * A pool's support, for one definition: the index rebuilt as the workspace
 * changes (only the changed documents re-read), its diagnostics published,
 * its editors refreshed.
 */
export const poolSupport = (
  id: string,
  registration: PoolRegistration,
  definition: AnyDialect,
): LanguageSupport => {
  const pool = createPool(registration);
  let index: PoolIndex = pool.update([]);
  let workspace: PoolWorkspace = { tree: null, resources: [] };
  let host: PoolHost | null = null;
  const listeners = new Set<() => void>();
  let published = new Set<string>();

  const texts = (path: string) =>
    workspace.resources.find((r) => r.path === path)?.text;

  /** Problems: a model field's on its element and key, a resource's by file and line */
  const publish = () => {
    const byUri = new Map<string, Problem[]>();
    const add = (uri: string, problem: Problem) =>
      byUri.set(uri, [...(byUri.get(uri) ?? []), problem]);
    for (const diagnostic of index.diagnostics) {
      const field = modelField(diagnostic.document);
      const problem = {
        severity: diagnostic.severity,
        source: id,
        message: field
          ? diagnostic.message
          : `${placeOf(diagnostic, texts)}: ${diagnostic.message}`,
        ...(field && {
          elementId: field.element,
          ...(field.field !== 'id' &&
            field.field !== 'name' && { key: field.field }),
        }),
        reveal: {
          document: diagnostic.document,
          from: diagnostic.from,
          to: diagnostic.to,
        },
      } as Problem;
      add(`pool:${field ? 'model' : diagnostic.document}`, problem);
    }
    for (const uri of published)
      if (!byUri.has(uri)) publishDiagnostics(id, uri, []);
    for (const [uri, problems] of byUri) publishDiagnostics(id, uri, problems);
    published = new Set(byUri.keys());
  };

  /** The extensions of one editor, given how its text maps onto the pool. */
  const extensionFor = (map: DocumentMap): Extension => {
    const at = (state: EditorState, offset: number) =>
      map.position(state, offset);

    const marks = (state: EditorState): DecorationSet =>
      Decoration.set(
        index.diagnostics
          .flatMap((d: PoolDiagnostic) => {
            const range = map.range(state, d);
            return range && range.to <= state.doc.length
              ? [
                  Decoration.mark({
                    class: `cm-lintRange cm-lintRange-${d.severity}`,
                    attributes: { title: d.message },
                  }).range(range.from, Math.max(range.to, range.from + 1)),
                ]
              : [];
          })
          .sort((a, b) => a.from - b.from),
        true,
      );
    const decorations = StateField.define<DecorationSet>({
      create: marks,
      update: (value, tr) =>
        tr.effects.some((e) => e.is(refreshed))
          ? marks(tr.state)
          : value.map(tr.changes),
      provide: (field) => EditorView.decorations.from(field),
    });

    const goToDefinition = (view: EditorView): boolean => {
      const position = at(view.state, view.state.selection.main.head);
      const location = position && definitionAt(index, position);
      if (!location) return false;
      host?.navigate(location);
      return true;
    };

    // the references panel and the rename panel
    type PanelState =
      | { kind: 'references'; items: PoolLocation[]; name: string }
      | {
          kind: 'rename';
          position: { document: string; offset: number };
          name: string;
        }
      | null;
    const setPanel = StateEffect.define<PanelState>();
    const panel = StateField.define<PanelState>({
      create: () => null,
      update: (value, tr) => {
        for (const e of tr.effects) if (e.is(setPanel)) return e.value;
        return value;
      },
      provide: (field) =>
        showPanel.from(field, (state) =>
          state ? (view) => panelOf(view, state) : null,
        ),
    });
    const close = (view: EditorView) => {
      view.dispatch({ effects: setPanel.of(null) });
      view.focus();
    };
    const panelOf = (
      view: EditorView,
      state: NonNullable<PanelState>,
    ): Panel => {
      const dom = document.createElement('div');
      dom.className = 'cm-pool-panel';
      dom.style.cssText =
        'padding:4px 8px;font-size:12px;max-height:160px;overflow:auto';
      if (state.kind === 'references') {
        const title = document.createElement('div');
        title.textContent = `${state.items.length} place${state.items.length === 1 ? '' : 's'} of ${state.name} (Escape closes)`;
        dom.append(title);
        for (const item of state.items) {
          const link = document.createElement('button');
          link.type = 'button';
          link.textContent = placeOf(item, texts);
          link.style.cssText =
            'display:block;text-align:left;text-decoration:underline;cursor:pointer';
          link.onclick = () => host?.navigate(item);
          dom.append(link);
        }
      } else {
        const label = document.createElement('label');
        label.textContent = `Rename ${state.name} to `;
        const input = document.createElement('input');
        input.value = state.name;
        input.setAttribute('aria-label', `New name for ${state.name}`);
        input.style.cssText = 'border:1px solid currentColor;padding:0 4px';
        const message = document.createElement('span');
        message.style.marginLeft = '8px';
        input.onkeydown = (event) => {
          if (event.key === 'Escape') close(view);
          if (event.key !== 'Enter') return;
          const edits = renameEdits(index, state.position, input.value);
          if (typeof edits === 'string') {
            message.textContent = edits;
            return;
          }
          const refused = host?.applyEdits(edits) ?? null;
          if (refused) {
            message.textContent = refused;
            return;
          }
          close(view);
        };
        label.append(input);
        dom.append(label, message);
        queueMicrotask(() => input.select());
      }
      return { dom, top: false };
    };

    return [
      decorations,
      panel,
      // refreshed when the pool is (a change in this file or another)
      ViewPlugin.define((view) => {
        const listener = () =>
          queueMicrotask(() => view.dispatch({ effects: refreshed.of(null) }));
        listeners.add(listener);
        // its problems are the workspace's, published as it changes: kept when the tab closes
        return { destroy: () => listeners.delete(listener) };
      }),
      hoverTooltip((view, offset) => {
        const position = at(view.state, offset);
        const hover = position && hoverAt(index, position);
        if (!hover) return null;
        const range = map.range(view.state, hover.location);
        const dom = document.createElement('div');
        dom.className = 'cm-pool-hover';
        dom.style.cssText = 'padding:4px 8px;font-size:12px;max-width:420px';
        const line = (text: string, bold = false) => {
          const div = document.createElement('div');
          div.textContent = text;
          if (bold) div.style.fontWeight = '600';
          dom.append(div);
        };
        const { definition: d } = hover;
        if (d) {
          line(
            `${hover.label ?? d.kind} ${d.name}${d.type ? ` : ${d.type}` : ''}`,
            true,
          );
          if (hover.owner) line(`of ${hover.owner.name}`);
          if (d.detail) line(d.detail);
          line(
            `defined at ${placeOf(d.location, texts)}, used ${hover.references} time${hover.references === 1 ? '' : 's'} (F12 goes there, Shift-F12 lists them, F2 renames)`,
          );
        } else if (hover.unresolved)
          line(`${hover.unresolved}: nothing defines it`, true);
        for (const diagnostic of hover.diagnostics) line(diagnostic.message);
        return {
          pos: range?.from ?? offset,
          end: range?.to ?? offset,
          above: true,
          create: () => ({ dom }),
        };
      }),
      Prec.high(
        keymap.of([
          { key: 'F12', run: goToDefinition },
          {
            key: 'Shift-F12',
            run: (view) => {
              const position = at(view.state, view.state.selection.main.head);
              const symbol = position && symbolAt(index, position);
              if (!symbol?.definition) return false;
              view.dispatch({
                effects: setPanel.of({
                  kind: 'references',
                  items: referencesAt(index, position!),
                  name: symbol.definition.name,
                }),
              });
              return true;
            },
          },
          {
            key: 'F2',
            run: (view) => {
              const position = at(view.state, view.state.selection.main.head);
              const symbol = position && symbolAt(index, position);
              if (!symbol?.definition) return false;
              view.dispatch({
                effects: setPanel.of({
                  kind: 'rename',
                  position: position!,
                  name: symbol.definition.name,
                }),
              });
              return true;
            },
          },
          {
            key: 'Escape',
            run: (view) => {
              if (!view.state.field(panel)) return false;
              close(view);
              return true;
            },
          },
        ]),
      ),
      EditorView.domEventHandlers({
        mousedown: (event, view) => {
          if (!(event.metaKey || event.ctrlKey)) return false;
          const offset = view.posAtCoords({
            x: event.clientX,
            y: event.clientY,
          });
          const position = offset !== null && at(view.state, offset);
          const location = position && definitionAt(index, position);
          if (!location) return false;
          event.preventDefault();
          host?.navigate(location);
          return true;
        },
      }),
      EditorState.languageData.of(() => [
        {
          autocomplete: (
            context: CompletionContext,
          ): CompletionResult | null => {
            const position = at(context.state, context.pos);
            if (!position) return null;
            const options = completionsAt(index, position);
            if (!options.length) return null;
            const shift = context.pos - position.offset;
            return {
              from: options[0]!.from + shift,
              to: options[0]!.to + shift,
              options: options.map((option) => ({
                label: option.label,
                detail: option.detail,
                type: 'variable',
              })),
            };
          },
        },
      ]),
    ];
  };

  const notationMap = (): DocumentMap => ({
    position: (state, offset) =>
      workspace.tree
        ? notationPosition(
            definition,
            workspace.tree,
            state.doc.toString(),
            offset,
          )
        : null,
    range: (state, location) =>
      workspace.tree
        ? notationRange(
            definition,
            workspace.tree,
            state.doc.toString(),
            location,
          )
        : null,
  });

  return {
    documentExtension: () => extensionFor(notationMap()),
    fieldExtension: (elementId, key) => {
      const document = `model:${elementId}:${key}`;
      return extensionFor({
        position: (_state, offset) => ({ document, offset }),
        range: (_state, location) =>
          location.document === document ? location : null,
      });
    },
    resourceExtension: (path) => [
      // the resource editors have no completion of their own
      autocompletion(),
      extensionFor({
        position: (_state, offset) => ({ document: path, offset }),
        range: (_state, location) =>
          location.document === path ? location : null,
      }),
    ],
    setContext: () => {},
    setSaved: () => {},
    setWorkspace: (next, nextHost) => {
      host = nextHost;
      if (
        next.tree === workspace.tree &&
        next.resources.length === workspace.resources.length &&
        next.resources.every(
          (r, i) =>
            r.path === workspace.resources[i]?.path &&
            r.text === workspace.resources[i]?.text,
        )
      )
        return;
      workspace = next;
      index = pool.update(poolDocuments(next));
      publish();
      listeners.forEach((listener) => listener());
    },
  };
};
