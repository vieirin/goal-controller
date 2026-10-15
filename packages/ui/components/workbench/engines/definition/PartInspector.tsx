'use client';

/**
 * A link's or an actor's properties (goal-controller#107), edited as an
 * element's are: the rows the dialect declares for its kind (`links`,
 * `actors`), each with the input its value type gives and the engine check
 * it names. Shown when the diagram selects a link or an actor in a dialect
 * that gives them properties.
 */
import {
  actorSpecsFromDefinition,
  inputOf,
  linkSpecsOfKind,
  type PropertySpec,
} from '@goal-controller/dialect';
import { checkContextOf } from '@goal-controller/goal-language';
import type { Check } from '@goal-controller/lib';
import { useMemo } from 'react';
import {
  ENGINE_CHECKS,
  ENGINE_DIALECTS,
  type DialectEngine,
} from '@/lib/workbench/engineDialects';
import { contextOf } from '@/lib/workbench/notationDocument';
import { setLinkProperty, setNodeProperty } from '@/lib/workbench/pistar';
import { type SelectedPart, useWorkbench } from '../../WorkbenchContext';
import { CreatableSelect } from '../../ui';
import { PropertyRow, useEditModel } from '../shared/inspector';

const kindLabel = (kind: string) => kind.replace(/^[^.]+\./, '');

export default function PartInspector({
  engine,
  part,
}: {
  engine: DialectEngine;
  part: SelectedPart;
}) {
  const wb = useWorkbench();
  const edit = useEditModel();
  const definition = ENGINE_DIALECTS[engine];
  const registry = ENGINE_CHECKS[engine] as Readonly<
    Record<string, Check | undefined>
  >;
  const { tree } = wb;
  const found =
    part.type === 'link'
      ? tree?.links.find((link) => link.iStarId === part.id)
      : tree?.actors.find((actor) => actor.iStarId === part.id);
  // the selected part's kind only: `found` changes on every model edit
  const kind = found?.kind;
  const specs: readonly PropertySpec<string, Check>[] = useMemo(
    () =>
      kind === undefined
        ? []
        : part.type === 'link'
          ? linkSpecsOfKind(definition, registry, kind)
          : actorSpecsFromDefinition(definition, registry, kind),
    [definition, registry, kind, part.type],
  );
  // a check of a link's or an actor's property is given its id as `self`
  const checkContext = useMemo(
    () =>
      checkContextOf(
        tree
          ? contextOf(definition, tree, [], wb.projectResources)
          : { elements: {}, variables: [] },
        part.id,
      ),
    [definition, tree, wb.projectResources, part.id],
  );
  if (!found) return null;
  const properties = found.properties;
  const write = (key: string, value: string | null) =>
    edit((text) =>
      part.type === 'link'
        ? setLinkProperty(text, part.id, key, value)
        : setNodeProperty(text, part.id, key, value),
    );
  const specOf = (key: string) => specs.find((spec) => spec.key === key);
  const applies = (key: string) => specOf(key)?.applies?.(properties) ?? true;
  // rows: the declared ones set or needed, in their order; then any other set one
  const keys = [
    ...new Set([
      ...specs
        .filter(
          (spec) =>
            spec.key in properties ||
            ((spec.applies?.(properties) ?? true) &&
              (spec.required?.(properties) ?? false)),
        )
        .map((spec) => spec.key),
      ...Object.keys(properties).filter((key) => key !== 'Description'),
    ]),
  ];
  const suggestions = specs
    .map((spec) => spec.key)
    .filter((key) => !keys.includes(key) && applies(key));
  const title =
    part.type === 'link'
      ? `${kindLabel(found.kind)} link`
      : `${kindLabel(found.kind)} ${'name' in found ? found.name : ''}`;

  return (
    <div className='space-y-3 p-3'>
      <div className='text-[13px] font-semibold text-ink'>{title}</div>
      <div className='space-y-1.5'>
        <span className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
          Properties
        </span>
        <div className='grid grid-cols-[minmax(0,max-content)_minmax(8rem,1fr)_auto] gap-1.5'>
          {keys.map((key) => {
            const spec = specOf(key);
            return (
              <PropertyRow
                key={key}
                name={key}
                value={properties[key]}
                engineKnows={!!spec}
                input={spec ? inputOf(spec, properties) : undefined}
                validate={
                  applies(key) && spec?.validate
                    ? (value) =>
                        spec.validate!(
                          { ...properties, [key]: value },
                          checkContext,
                        )
                    : undefined
                }
                notApplying={
                  !applies(key) && properties[key] !== undefined
                    ? (spec?.notApplying?.(properties) ??
                      'Not used with the other properties set')
                    : null
                }
                notReadBy={
                  spec ? null : `Not read for a ${kindLabel(found.kind)}`
                }
                onChange={(value) => write(key, value)}
              />
            );
          })}
        </div>
        {suggestions.length > 0 && (
          <CreatableSelect
            className='pt-1'
            label='Add a property'
            placeholder='Add a property'
            options={suggestions.map((key) => ({ value: key }))}
            createLabel={(key) => `Add "${key}"`}
            onSelect={(key) => {
              if (key && !(key in properties)) write(key, '');
            }}
          />
        )}
      </div>
    </div>
  );
}
