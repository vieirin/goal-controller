'use client';

import { useState, type ComponentType, type FormEvent } from 'react';
import { defineProperties, type PropertyShape } from '@istar-ts/core';
import {
  DefaultElementInspector,
  DefaultLinkInspector,
  HubInspector,
  HubPartInspector,
  InspectorField,
  useIstarEditor,
  type InspectorProps,
} from '@istar-ts/react';
import type { IstarElement, IstarLink } from '@istar-ts/core';
import { keyedKey, type PropertyDefinition } from '@goal-controller/dialect';
import { keyedKeyOf } from '@goal-controller/goal-language';
import { itemKeyedShape } from '@/lib/workbench/frameworkProperties';

/**
 * The inspector of a kind with properties keyed by names an item has
 * (goal-controller#376: kaossim's `QualityVariable[ResponseTime]`, a hub's
 * `Equation[v]`, an assignment's `Distribution[v]`): istar-ts's own for the
 * kind (an element's, a hub's, a link's or a hub part's), with a field per
 * keyed key the item stores added to its kind's schema, and a row that adds
 * a name (`Key[name]`, unset).
 */
export const keyedElementInspector = (
  keyed: readonly PropertyDefinition[],
): ComponentType<InspectorProps<IstarElement>> =>
  function KeyedElementInspector(props: InspectorProps<IstarElement>) {
    const { metamodel } = useIstarEditor();
    const schema = keyedSchema(keyed, props);
    const Inspector =
      metamodel.elements.get(props.target.kind)?.role === 'hub'
        ? HubInspector
        : DefaultElementInspector;
    return (
      <>
        <Inspector {...props} schema={schema} />
        <AddName keyed={keyed} {...props} />
      </>
    );
  };

/** The same, for a link kind: a hub part's (its hub's, then its own), or any other link's. */
export const keyedLinkInspector = (
  keyed: readonly PropertyDefinition[],
): ComponentType<InspectorProps<IstarLink>> =>
  function KeyedLinkInspector(props: InspectorProps<IstarLink>) {
    const { metamodel } = useIstarEditor();
    const schema = keyedSchema(keyed, props);
    const role = metamodel.links.get(props.target.kind)?.role;
    const Inspector =
      role === 'leg' || role === 'end'
        ? HubPartInspector
        : DefaultLinkInspector;
    return (
      <>
        <Inspector {...props} schema={schema} />
        <AddName keyed={keyed} {...props} />
      </>
    );
  };

/** The kind's schema, with a field per keyed key the item stores. */
const keyedSchema = (
  keyed: readonly PropertyDefinition[],
  {
    schema,
    target,
  }: Pick<InspectorProps<IstarElement | IstarLink>, 'schema' | 'target'>,
) => {
  const shape: PropertyShape = {
    ...schema?.shape,
    ...itemKeyedShape(keyed, target.customProperties),
  };
  return Object.keys(shape).length
    ? defineProperties<PropertyShape, IstarElement['kind'] | IstarLink['kind']>(
        target.kind,
        shape,
      )
    : undefined;
};

/** A row that adds a name to one of the keyed properties: `Key[name]`, unset. */
function AddName({
  keyed,
  target,
  actions,
  readOnly,
}: { keyed: readonly PropertyDefinition[] } & Pick<
  InspectorProps<IstarElement | IstarLink>,
  'target' | 'actions' | 'readOnly'
>) {
  const keys = keyed.map((property) => property.key);
  const [key, setKey] = useState(keys[0] ?? '');
  const [name, setName] = useState('');
  const written = name.trim();
  // a name the grammar reads back in its key (no spaces, no brackets), not one it has
  const readable =
    !!written && keyedKeyOf(keyedKey(key, written))?.name === written;
  const taken =
    readable && keyedKey(key, written) in (target.customProperties ?? {});
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!readable || taken) return;
    actions.setProperties({ [keyedKey(key, written)]: '' });
    setName('');
  };
  if (readOnly) return null;
  return (
    <form className='istar-inspector-body' onSubmit={submit}>
      <InspectorField
        label='Add a name'
        issue={
          taken
            ? `${keyedKey(key, written)} is set already`
            : written && !readable
              ? 'A name has no spaces or brackets'
              : undefined
        }
      >
        <div className='flex gap-1'>
          {keys.length > 1 && (
            <select
              aria-label='Keyed property'
              value={key}
              onChange={(event) => setKey(event.target.value)}
            >
              {keys.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
          <input
            aria-label={`New ${key} name`}
            placeholder='name'
            value={name}
            onChange={(event) => setName(event.target.value)}
            className='min-w-0 flex-1'
          />
          <button
            type='submit'
            className='istar-icon-button'
            disabled={!readable || taken}
          >
            Add name
          </button>
        </div>
      </InspectorField>
    </form>
  );
}
