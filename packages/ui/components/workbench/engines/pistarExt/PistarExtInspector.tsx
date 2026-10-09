'use client';

import {
  ISTAR_ACTOR_KINDS,
  ISTAR_LINK_KINDS,
  ISTAR_NODE_KINDS,
  annotationKeys,
  extensionCatalog,
  fillOf,
  inputOf,
  kindLabel,
  profileProperties,
  specsFromDefinition,
  takenName,
  withModelExtension,
  type CatalogCategory,
  type ExtensionDefinition,
  type ModelExtension,
  type PropertySpec,
} from '@goal-controller/definitions';
import type { IstarElement, IstarLink } from '@istar-ts/core';
import { useIstarEditor, useSelectedTarget } from '@istar-ts/react';
import { useMemo, useState } from 'react';
import {
  DIALECTS,
  writeModelExtension,
  type ModelDialect,
} from '@/lib/workbench/dialects';
import { useWorkbench } from '../../WorkbenchContext';
import { cx } from '../../ui';
import { ColorField, inputClass, useDraft } from '../shared/inspector';
import { labelAnnotations } from './extensions';
import { usePistarExt } from './usePistarExt';

/**
 * piStar-ext's properties panel, beside the diagram, in tabs as piStar-ext has
 * them. With nothing selected: the model's properties, then one tab per set
 * the dialect declares (its stereotypes, tagged values, groupers). With an
 * element or link: its properties (name, description, and its stereotype and
 * tagged value in an Extension table), and its style. Every list comes from
 * the dialect's definition.
 */

const dialect: ExtensionDefinition = DIALECTS.pistarext;
const KEYS = annotationKeys(dialect);
const READ_ONLY = `Declared by the ${dialect.label} dialect (its definition), so read-only here`;

/** What each kind may carry, in the model's dialect; a dialect has no engine: no checks. */
const specsOf = ({
  extension,
  definition,
}: ModelDialect): Record<string, PropertySpec<string, unknown>[]> => ({
  ...specsFromDefinition(definition, {}),
  // links have no lines of their own: their profile, as for an element's kind
  ...specsFromDefinition(
    {
      id: extension.name,
      properties: Object.fromEntries(
        [...ISTAR_LINK_KINDS, ...extension.links.map((l) => l.kind)].map(
          (kind) => [kind, profileProperties(extension, kind)],
        ),
      ),
    },
    {},
  ),
});
const NEW_VALUE = '\u0000new';

function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role='tablist'
      className='-mx-3 mb-3 flex flex-wrap border-b border-line px-1.5'
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type='button'
          role='tab'
          aria-selected={tab.id === active}
          onClick={() => onChange(tab.id)}
          className={cx(
            '-mb-px whitespace-nowrap border-b-2 px-1.5 py-1.5 text-[11px]',
            tab.id === active
              ? 'border-ink font-semibold text-ink'
              : 'border-transparent text-ink-muted hover:text-ink',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function PistarExtInspector() {
  const target = useSelectedTarget();
  // istar-ts's inspector panel: its width, scrolling and border beside the canvas
  return (
    <aside className='istar-inspector' aria-label='Inspector'>
      {target ? (
        <TargetPanel key={target.id} target={target} />
      ) : (
        <ModelPanel />
      )}
    </aside>
  );
}

type ModelTab = 'properties' | CatalogCategory['id'];

/** Nothing selected: the model's properties and the dialect's declared sets. */
function ModelPanel() {
  const [tab, setTab] = useState<ModelTab>('properties');
  const { model } = useIstarEditor();
  const read = usePistarExt();
  const catalog = useMemo(() => extensionCatalog(read.extension), [read]);
  const category = catalog.find((c) => c.id === tab);
  return (
    <>
      <Tabs
        tabs={[
          { id: 'properties' as ModelTab, label: 'Properties' },
          ...catalog.map((c) => ({ id: c.id as ModelTab, label: c.label })),
        ]}
        active={tab}
        onChange={setTab}
      />
      {category ? (
        <CategoryPanel category={category} read={read} />
      ) : (
        <dl className='space-y-2 text-[13px]'>
          <Row label='Name' value={model.diagram?.name} />
          <Row
            label='Description'
            value={model.diagram?.customProperties?.Description}
          />
          <Row label='Dialect' value={dialect.label} />
        </dl>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className='grid grid-cols-[6rem_1fr] gap-2'>
      <dt className='font-semibold text-ink-soft'>{label}</dt>
      <dd className={value ? 'text-ink' : 'text-danger'}>{value || 'Empty'}</dd>
    </div>
  );
}

/** A model's own entries in a category, by name (the dialect's are read-only). */
const ownNames = (
  model: ModelExtension,
  id: CatalogCategory['id'],
): string[] =>
  id === 'groupers'
    ? Object.keys(model.groupers ?? {})
    : (model[id] ?? []).map((entry) => entry.name);

const TAKEN_AS = {
  stereotypes: 'stereotype',
  taggedValues: 'taggedValue',
  groupers: 'grouper',
} as const;

/**
 * A category's entries, and the form adding one. The dialect's entries are
 * read-only (its definition declares them); the model's own, kept in its file
 * as piStar-ext keeps its lists, can be added and deleted.
 */
function CategoryPanel({
  category,
  read,
}: {
  category: CatalogCategory;
  read: ModelDialect;
}) {
  const wb = useWorkbench();
  const own = ownNames(read.model, category.id);
  const [name, setName] = useState('');
  const [applied, setApplied] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // what an entry may apply to: every kind (and, but for a grouper, a grouper)
  const kinds = [
    ...ISTAR_ACTOR_KINDS,
    ...ISTAR_NODE_KINDS,
    ...ISTAR_LINK_KINDS,
    ...read.extension.elements.map((e) => e.kind),
    ...read.extension.links.map((l) => l.kind),
  ];
  const targets =
    category.id === 'groupers'
      ? kinds
      : [...Object.keys(read.extension.groupers), ...kinds];
  const save = (model: ModelExtension) => {
    try {
      withModelExtension(dialect, model);
      wb.setText(writeModelExtension(wb.text, model), 'inspector');
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };
  const add = () => {
    const trimmed = name.trim();
    const problem = !trimmed
      ? 'Give it a name'
      : !applied.length
        ? 'Choose what it applies to'
        : takenName(read.extension, TAKEN_AS[category.id], trimmed);
    if (problem) return setError(problem);
    const model = read.model;
    const added =
      category.id === 'groupers'
        ? { ...model, groupers: { ...model.groupers, [trimmed]: applied } }
        : {
            ...model,
            [category.id]: [
              ...(model[category.id] ?? []),
              { name: trimmed, appliesTo: applied },
            ],
          };
    if (save(added)) {
      setName('');
      setApplied([]);
    }
  };
  const remove = (entry: string) => {
    const model = read.model;
    if (category.id === 'groupers') {
      const { [entry]: _gone, ...rest } = model.groupers ?? {};
      save({ ...model, groupers: rest });
    } else
      save({
        ...model,
        [category.id]: (model[category.id] ?? []).filter(
          (e) => e.name !== entry,
        ),
      });
  };
  return (
    <div className='space-y-3 text-[13px]'>
      <table className='w-full text-left'>
        <thead>
          <tr className='text-2xs text-ink-muted'>
            <th className='py-1 font-semibold'>Name</th>
            <th className='py-1 font-semibold'>Constructs Applied</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {category.entries.map((entry) => {
            const editable = own.includes(entry.name);
            return (
              <tr
                key={entry.name}
                className='border-t border-line'
                title={editable ? "This model's own" : READ_ONLY}
              >
                <td className='py-1 pr-2'>{entry.name}</td>
                <td className='py-1 pr-2 text-ink-soft'>
                  {entry.appliesTo.join(', ')}
                </td>
                <td className='py-1 text-right'>
                  <button
                    type='button'
                    disabled={!editable}
                    title={editable ? `Delete ${entry.name}` : READ_ONLY}
                    onClick={() => remove(entry.name)}
                    className={cx(
                      'text-2xs',
                      editable ? 'text-danger' : 'text-ink-faint',
                    )}
                  >
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <fieldset className='space-y-1.5'>
        <legend className='pb-1 font-semibold text-ink'>
          Add New {category.label}
        </legend>
        <label className='block space-y-0.5'>
          <span className='text-2xs text-ink-muted'>Name</span>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </label>
        <label className='block space-y-0.5'>
          <span className='text-2xs text-ink-muted'>Constructs Applied</span>
          <select
            className={cx(inputClass, category.id === 'groupers' && 'h-24')}
            multiple={category.id === 'groupers'}
            value={category.id === 'groupers' ? applied : (applied[0] ?? '')}
            onChange={(e) =>
              setApplied(
                [...e.target.selectedOptions]
                  .map((o) => o.value)
                  .filter(Boolean),
              )
            }
          >
            {category.id !== 'groupers' && <option value='' />}
            {targets.map((target) => (
              <option key={target} value={target}>
                {target in read.extension.groupers
                  ? `${target} (grouper)`
                  : kindLabel(target)}
              </option>
            ))}
          </select>
        </label>
        <button
          type='button'
          onClick={add}
          className='rounded border border-line px-2 py-0.5 text-xs hover:bg-panel'
        >
          Add
        </button>
        {error && (
          <p role='alert' className='text-2xs text-danger'>
            {error}
          </p>
        )}
      </fieldset>
      <p className='text-2xs text-ink-muted'>
        The {dialect.label} dialect&apos;s entries are its definition&apos;s
        (read-only); what you add is this model&apos;s, kept in its file.
      </p>
    </div>
  );
}

type TargetTab = 'properties' | 'style';

/** An element or link: its properties and its style. */
function TargetPanel({ target }: { target: IstarElement | IstarLink }) {
  const [tab, setTab] = useState<TargetTab>('properties');
  const editor = useIstarEditor();
  const read = usePistarExt();
  const specs = useMemo(() => specsOf(read), [read]);
  const isLink = 'source' in target;
  const elementActions = isLink ? null : editor.elementActions(target.id);
  const linkActions = isLink ? editor.linkActions(target.id) : null;
  const setProperties = (patch: Record<string, string | undefined>) =>
    (elementActions ?? linkActions)!.setProperties(patch);
  const label =
    (isLink
      ? editor.metamodel.links.get(target.kind)?.label
      : editor.metamodel.elements.get(target.kind)?.label) ?? target.kind;
  const groupers = Object.entries(dialect.groupers)
    .filter(([, kinds]) => (kinds as readonly string[]).includes(target.kind))
    .map(([name]) => name);
  const properties = target.customProperties ?? {};
  const name = useDraft(target.name ?? '', (next) =>
    elementActions
      ? elementActions.rename(next)
      : linkActions!.setName(next || undefined),
  );
  const description = useDraft(properties.Description ?? '', (next) =>
    setProperties({ Description: next }),
  );
  const annotations = labelAnnotations(target);
  return (
    <>
      <Tabs
        tabs={[
          { id: 'properties' as TargetTab, label: 'Properties' },
          { id: 'style' as TargetTab, label: 'Style' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'style' ? (
        elementActions ? (
          <ColorField
            color={
              typeof target.display?.backgroundColor === 'string'
                ? target.display.backgroundColor
                : null
            }
            fallback={fillOf(read.definition, target.kind)}
            onChange={(color) =>
              elementActions.setDisplay({
                backgroundColor: color ?? undefined,
              })
            }
          />
        ) : (
          <p className='text-[13px] text-ink-muted'>Links have no style.</p>
        )
      ) : (
        <div className='space-y-3 text-[13px]'>
          <div className='space-y-0.5'>
            <p className='font-semibold text-ink'>{label}</p>
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
          <label className='block space-y-0.5'>
            <span className='text-2xs font-semibold text-ink-soft'>Name</span>
            <input
              className={inputClass}
              value={name.draft}
              readOnly={editor.readOnly}
              onChange={(e) => name.change(e.target.value)}
              onBlur={name.flush}
            />
          </label>
          <label className='block space-y-0.5'>
            <span className='text-2xs font-semibold text-ink-soft'>
              Description
            </span>
            <input
              className={cx(
                inputClass,
                !description.draft && 'placeholder:text-danger',
              )}
              placeholder='Empty'
              value={description.draft}
              readOnly={editor.readOnly}
              onChange={(e) => description.change(e.target.value)}
              onBlur={description.flush}
            />
          </label>
          <ExtensionTable
            specs={specs[target.kind] ?? []}
            properties={properties}
            readOnly={editor.readOnly}
            onChange={setProperties}
          />
        </div>
      )}
    </>
  );
}

/**
 * The Extension table: a stereotype and a tagged value, each picked from what
 * the kind's profile lists, `Not Used`, or `New Value` (typed: the profile's
 * lists are open), and the tagged value's value.
 */
function ExtensionTable({
  specs,
  properties,
  readOnly,
  onChange,
}: {
  specs: readonly PropertySpec<string, unknown>[];
  properties: Readonly<Record<string, string | undefined>>;
  readOnly: boolean;
  onChange: (patch: Record<string, string | undefined>) => void;
}) {
  const specOf = (key: string | undefined) =>
    specs.find((spec) => spec.key === key);
  const stereotype = specOf(KEYS.stereotype);
  const tag = specOf(KEYS.tag);
  const tagValue = specOf(KEYS.tagValue);
  return (
    <div className='space-y-1'>
      <span className='text-2xs font-semibold uppercase tracking-wider text-ink-muted'>
        Extension
      </span>
      <table className='w-full text-left text-xs'>
        <thead>
          <tr className='text-2xs text-ink-muted'>
            <th className='py-1 font-semibold'>Type</th>
            <th className='py-1 font-semibold'>Value</th>
          </tr>
        </thead>
        <tbody>
          {stereotype && (
            <tr className='border-t border-line align-top'>
              <th className='py-1.5 pr-2 font-medium text-ink-soft'>
                Stereotype
              </th>
              <td className='space-y-1 py-1.5'>
                <OpenSelect
                  spec={stereotype}
                  properties={properties}
                  readOnly={readOnly}
                  onChange={(value) => onChange({ [stereotype.key]: value })}
                />
              </td>
            </tr>
          )}
          {tag && (
            <tr className='border-t border-line align-top'>
              <th className='py-1.5 pr-2 font-medium text-ink-soft'>
                TaggedValue
              </th>
              <td className='space-y-1 py-1.5'>
                <OpenSelect
                  spec={tag}
                  properties={properties}
                  readOnly={readOnly}
                  onChange={(value) =>
                    onChange({
                      [tag.key]: value,
                      // a value belongs to its tag
                      ...(tagValue && value === undefined
                        ? { [tagValue.key]: undefined }
                        : {}),
                    })
                  }
                />
                {tagValue && properties[tag.key] !== undefined && (
                  <ValueField
                    spec={tagValue}
                    properties={properties}
                    readOnly={readOnly}
                    onChange={(value) => onChange({ [tagValue.key]: value })}
                  />
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** A select of the listed values, `Not Used` and `New Value` (then typed). */
function OpenSelect({
  spec,
  properties,
  readOnly,
  onChange,
}: {
  spec: PropertySpec<string, unknown>;
  properties: Readonly<Record<string, string | undefined>>;
  readOnly: boolean;
  onChange: (value: string | undefined) => void;
}) {
  const input = inputOf(spec, properties);
  const listed =
    input.kind === 'select'
      ? input.options.filter((o) => o.value !== '').map((o) => o.value)
      : [];
  const value = properties[spec.key];
  const [typing, setTyping] = useState(
    value !== undefined && !listed.includes(value),
  );
  const typed = useDraft(value ?? '', (next) => onChange(next || undefined));
  return (
    <>
      <select
        className={cx(inputClass, 'font-mono text-xs')}
        aria-label={spec.key}
        disabled={readOnly}
        value={typing ? NEW_VALUE : (value ?? '')}
        onChange={(e) => {
          const next = e.target.value;
          setTyping(next === NEW_VALUE);
          if (next !== NEW_VALUE) onChange(next || undefined);
        }}
      >
        <option value=''>Not Used</option>
        <option value={NEW_VALUE}>New Value</option>
        {listed.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {typing && (
        <input
          className={cx(inputClass, 'font-mono text-xs')}
          aria-label={`${spec.key} (new value)`}
          placeholder='New value'
          value={typed.draft}
          readOnly={readOnly}
          onChange={(e) => typed.change(e.target.value)}
          onBlur={typed.flush}
        />
      )}
    </>
  );
}

/** A tagged value's value: its listed values, or text. */
function ValueField({
  spec,
  properties,
  readOnly,
  onChange,
}: {
  spec: PropertySpec<string, unknown>;
  properties: Readonly<Record<string, string | undefined>>;
  readOnly: boolean;
  onChange: (value: string | undefined) => void;
}) {
  const input = inputOf(spec, properties);
  const value = properties[spec.key];
  const draft = useDraft(value ?? '', (next) => onChange(next || undefined));
  return input.kind === 'select' ? (
    <select
      className={cx(inputClass, 'font-mono text-xs')}
      aria-label={spec.key}
      disabled={readOnly}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      {input.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.value ? option.label : 'Empty'}
        </option>
      ))}
    </select>
  ) : (
    <input
      className={cx(
        inputClass,
        'font-mono text-xs',
        !draft.draft && 'placeholder:text-danger',
      )}
      aria-label={spec.key}
      placeholder='Empty'
      value={draft.draft}
      readOnly={readOnly}
      onChange={(e) => draft.change(e.target.value)}
      onBlur={draft.flush}
    />
  );
}
