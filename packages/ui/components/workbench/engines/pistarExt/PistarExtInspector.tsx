'use client';

import {
  inputOf,
  specsFromDefinition,
  type ExtensionDefinition,
} from '@goal-controller/definitions';
import type { IstarElement } from '@istar-ts/core';
import { useIstarEditor, useSelectedTarget } from '@istar-ts/react';
import { DIALECTS, DIALECT_DEFINITIONS } from '@/lib/workbench/dialects';
import { Field, PropertyRow, inputClass, useDraft } from '../shared/inspector';
import { labelAnnotations } from './extensions';

const dialect: ExtensionDefinition = DIALECTS.pistarext;
const definition = DIALECT_DEFINITIONS.pistarext;
// what each kind may carry; a dialect has no engine, so no checks to bind
const SPECS = specsFromDefinition(definition, {});

/**
 * piStar-ext's inspector, beside the diagram: the selected element's name, and the
 * stereotype and tagged value its kind may carry (directly or through a grouper),
 * from the dialect's definition.
 */
export default function PistarExtInspector() {
  const target = useSelectedTarget();
  if (!target)
    return (
      <p className='p-4 text-[13px] text-ink-muted'>
        Select an element to edit its name, stereotype and tagged value.
      </p>
    );
  if ('source' in target)
    return (
      <p className='p-4 text-[13px] text-ink-muted'>
        Links carry no stereotypes or tagged values in this dialect.
      </p>
    );
  return <ElementEditor key={target.id} element={target} />;
}

function ElementEditor({ element }: { element: IstarElement }) {
  const editor = useIstarEditor();
  const actions = editor.elementActions(element.id);
  const label =
    editor.metamodel.elements.get(element.kind)?.label ?? element.kind;
  const groupers = Object.entries(dialect.groupers)
    .filter(([, kinds]) => (kinds as readonly string[]).includes(element.kind))
    .map(([name]) => name);
  const name = useDraft(element.name, (next) => actions.rename(next));
  const properties = element.customProperties ?? {};
  const annotations = labelAnnotations(element);
  return (
    <div className='space-y-4 p-4'>
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
          {(SPECS[element.kind] ?? []).map((spec) => (
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
