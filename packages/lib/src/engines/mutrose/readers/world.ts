/**
 * MutRoSe's world knowledge (`knowledge/world_db.xml`), typed
 * (goal-controller#79): under its root, one element per entity, its tag its
 * class and its children its attributes. As facts (#75): the first tag of a
 * class or of a class's attribute defines it; every later one (closing tags
 * too) refers to it. An attribute holding entities (`<objects><Object>…`) is
 * a sequence of them; an attribute's values give its type (world.rls).
 */
import * as z from 'zod/mini';
import {
  read,
  type At,
  type Path,
  type Reader,
  type ReadProblem,
} from '../../../readers';
import { parseXmlTree } from '../../../readers/xml';
import {
  ref,
  type DocumentFacts,
  type KindDefinition,
  type RuleRelation,
} from '../../ruleFacts/facts';

/** An element, as the XML reader gives it. */
export type WorldElement = {
  name: string;
  close?: string;
  attributes: Record<string, string>;
  children: WorldElement[];
  text?: string;
};

const element: z.ZodMiniType<WorldElement> = z.lazy(() =>
  z.strictObject({
    name: z.string(),
    close: z.optional(z.string()),
    attributes: z.record(z.string(), z.string()),
    children: z.array(element),
    text: z.optional(z.string()),
  }),
);

export const WORLD_KINDS: Readonly<Record<string, KindDefinition>> = {
  'world.root': { label: 'world root' },
  'world.class': { label: 'world class' },
  'world.attribute': { label: 'attribute', scope: 'owner' },
  'world.instance': { label: 'world instance' },
  // a value that may name an instance: unresolved is no problem
  'world.value': { label: 'world instance', scope: 'optional' },
};

const valueKind = (value: string) =>
  /^(true|false)$/i.test(value)
    ? 'Boolean'
    : /^-?\d+$/.test(value)
      ? 'Integer'
      : /^-?\d+\.\d+$/.test(value)
        ? 'Real'
        : 'String';

/** What a world means: its facts, and what the decomposer would miss in it. */
export type WorldReading = { facts: DocumentFacts; warnings: ReadProblem[] };

const warningsOf = (root: WorldElement, at: At): ReadProblem[] => {
  const warnings: ReadProblem[] = [];
  /** at a tag's name */
  const warn = (path: Path, message: string) => {
    const { from, to } = at([...path, 'name'])!;
    warnings.push({ severity: 'warning', message, from, to });
  };
  root.children.forEach((entity, i) => {
    if (!nameOf(entity))
      warn(
        ['children', i],
        `This ${entity.name} has no name: the decomposer names entities by their \`name\``,
      );
  });
  if (!root.children.length) warn([], `<${root.name}> has no entities`);
  return warnings;
};

/** An entity's name: its `name` attribute or child. */
export const nameOf = (entity: WorldElement): string | undefined =>
  entity.attributes.name ??
  entity.children.find((child) => child.name === 'name')?.text;

const worldFacts = (
  root: WorldElement,
  at: At,
  document: string,
): DocumentFacts => {
  const relations: RuleRelation[] = [];
  const facts: DocumentFacts = {
    document,
    text: '',
    definitions: [],
    references: [],
    relations,
  };
  const located = (path: Path) => {
    const { from, to } = at(path)!;
    return { document, from, to };
  };
  let counter = 0;
  const refer = (kind: string, name: string, path: Path, owner?: string) => {
    const id = `w${counter++}`;
    facts.references.push({
      kinds: [kind],
      name,
      location: located(path),
      id,
      ...(owner && { scope: { owner } }),
    });
    return id;
  };
  facts.definitions.push({
    id: `world.root:${root.name}`,
    kind: 'world.root',
    name: root.name,
    location: located(['name']),
  });
  if (root.close) refer('world.root', root.name, ['close']);
  const classes = new Set<string>();
  const attributes = new Set<string>();
  /** an entity: its tag its class, its children its attributes (an attribute may hold entities) */
  const entity = (element: WorldElement, path: Path) => {
    const classId = `world.class:${element.name}`;
    if (classes.has(element.name))
      refer('world.class', element.name, [...path, 'name']);
    else {
      classes.add(element.name);
      facts.definitions.push({
        id: classId,
        kind: 'world.class',
        name: element.name,
        location: located([...path, 'name']),
      });
    }
    if (element.close) refer('world.class', element.name, [...path, 'close']);
    element.children.forEach((child, i) => {
      const at = [...path, 'children', i];
      const attributeId = `world.attribute:${element.name}/${child.name}`;
      // `<objects><Object>…</Object></objects>`: a sequence of entities
      const [nested] = child.children;
      if (attributes.has(attributeId))
        refer('world.attribute', child.name, [...at, 'name'], classId);
      else {
        attributes.add(attributeId);
        facts.definitions.push({
          id: attributeId,
          kind: 'world.attribute',
          name: child.name,
          location: located([...at, 'name']),
          owner: classId,
          ...(nested && { type: `Sequence(${nested.name})` }),
        });
      }
      if (child.close)
        refer('world.attribute', child.name, [...at, 'close'], classId);
      child.children.forEach((grandchild, j) =>
        entity(grandchild, [...at, 'children', j]),
      );
      if (!child.text) return;
      if (child.name === 'name')
        facts.definitions.push({
          id: `world.instance:${child.text}`,
          kind: 'world.instance',
          name: child.text,
          location: located([...at, 'text']),
          owner: classId,
        });
      else {
        const value = refer('world.value', child.text, [...at, 'text']);
        relations.push(
          ['world_attrValue', attributeId, child.text],
          ['world_valueKind', attributeId, valueKind(child.text)],
          ['world_valueRef', ref(value)],
        );
      }
    });
  };
  root.children.forEach((child, i) => entity(child, ['children', i]));
  return facts;
};

export const worldReader: Reader<WorldElement, WorldReading> = {
  parse: parseXmlTree,
  schema: element,
  facts: (root, at, document) => ({
    facts: worldFacts(root, at, document),
    warnings: warningsOf(root, at),
  }),
};

/** The world's facts (its last good ones while it doesn't parse). */
export const readWorld = (document: string, text: string): DocumentFacts => {
  const { facts } = read(worldReader, document, text);
  return facts
    ? { ...facts.facts, text }
    : { document, text, definitions: [], references: [], relations: [] };
};
