'use client';

import {
  ISTAR_LINK_KINDS,
  inputOf,
  profileProperties,
  specsFromDefinition,
  type ExtensionDefinition,
} from '@goal-controller/definitions';
import type { IstarElement, IstarLink } from '@istar-ts/core';
import { useIstarEditor, useSelectedTarget } from '@istar-ts/react';
import { DIALECTS, DIALECT_DEFINITIONS } from '@/lib/workbench/dialects';
import { Field, PropertyRow, inputClass, useDraft } from '../shared/inspector';
import { labelAnnotations } from './extensions';

const dialect: ExtensionDefinition = DIALECTS.pistarext;
// what each kind may carry; a dialect has no engine, so no checks to bind
const SPECS = {
  ...specsFromDefinition(DIALECT_DEFINITIONS.pistarext, {}),
  // links have no lines of their own: their profile, as for an element's kind
  ...specsFromDefinition(
    {
      id: dialect.name,
      properties: Object.fromEntries(
        [...ISTAR_LINK_KINDS, ...dialect.links.map((l) => l.kind)].map(
          (kind) => [kind, profileProperties(dialect, kind)],
        ),
      ),
    },
    {},
  ),
};

/**
 * piStar-ext's inspector, beside the diagram: the selected element's or link's name,
 * and the stereotype and tagged value its kind may carry (directly or through a
 * grouper), from the dialect's definition.
 */
export default function PistarExtInspector() {
  const target = useSelectedTarget();
  // istar-ts's inspector panel: its width, scrolling and border beside the canvas
  return (
    <aside className='istar-inspector' aria-label='Inspector'>
      {target ? (
        <TargetEditor key={target.id} target={target} />
      ) : (
        <p className='text-[13px] text-ink-muted'>
          Select an element or a link to edit its name, stereotype and tagged
          value.
        </p>
      )}
    </aside>
  );
}

function TargetEditor({ target }: { target: IstarElement | IstarLink }) {
  const editor = useIstarEditor();
  const isLink = 'source' in target;
  const actions = isLink
    ? editor.linkActions(target.id)
    : editor.elementActions(target.id);
  const label =
    (isLink
      ? editor.metamodel.links.get(target.kind)?.label
      : editor.metamodel.elements.get(target.kind)?.label) ?? target.kind;
  const groupers = Object.entries(dialect.groupers)
    .filter(([, kinds]) => (kinds as readonly string[]).includes(target.kind))
    .map(([name]) => name);
  const name = useDraft(target.name ?? '', (next) =>
    'rename' in actions
      ? actions.rename(next)
      : actions.setName(next || undefined),
  );
  const properties = target.customProperties ?? {};
  const annotations = labelAnnotations(target);
  return (
    <div className='space-y-4'>
      <div className='space-y-0.5'>
        <p className='text-[13px] font-semibold text-ink'>{label}</p>
        {groupers.length > 0 && (
          <p className='text-2xs text-ink-muted'>
            In the {groupers.join(', ')} grouper
          </p>
        )}
        {annotations && (
          <p className='font-mono text-2xs italic text-ink-soft'>
            {annotations}
          </p>
        )}
      </div>
      <Field label='Name'>
        <input
          className={inputClass}
          value={name.draft}
          readOnly={editor.readOnly}
          onChange={(e) => name.change(e.target.value)}
          onBlur={name.flush}
        />
      </Field>
      <div className='space-y-1.5'>
        <span className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
          {dialect.label}
        </span>
        <div className='grid grid-cols-[minmax(0,max-content)_minmax(8rem,1fr)_auto] gap-1.5'>
          {(SPECS[target.kind] ?? []).map((spec) => (
            <PropertyRow
              key={spec.key}
              name={spec.key}
              value={properties[spec.key]}
              engineKnows={false}
              input={inputOf(spec, properties)}
              notReadBy={null}
              onChange={(value) =>
                actions.setProperties({ [spec.key]: value ?? undefined })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
