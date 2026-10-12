/**
 * MutRoSe's world knowledge (`knowledge/world_db.xml`) as facts
 * (goal-controller#75): under its root, one element per entity, its tag its
 * class and its children its attributes. The first tag of a class or of a
 * class's attribute defines it; every later one (closing tags too) refers to
 * it. An attribute holding entities (`<objects><Object>…`) is a sequence of
 * them; an attribute's values give its type (world.rls).
 */
import { readXml, type XmlElement } from '../projectResources/xml';
import {
  ref,
  type DocumentFacts,
  type KindDefinition,
  type RuleLocation,
  type RuleRelation,
} from '../../ruleFacts/facts';

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

export const readWorld = (document: string, text: string): DocumentFacts => {
  const relations: RuleRelation[] = [];
  const facts: DocumentFacts = {
    document,
    text,
    definitions: [],
    references: [],
    relations,
  };
  const { root } = readXml(text);
  if (!root) return facts;
  let counter = 0;
  const at = (from: number, name: string): RuleLocation => ({
    document,
    from,
    to: from + name.length,
  });
  /** an element's opening tag name, and its closing one (none when self-closed) */
  const tags = (element: XmlElement) => {
    const close = text.lastIndexOf(`</${element.name}`, element.to);
    return {
      open: at(element.from + 1, element.name),
      close: close > element.from ? at(close + 2, element.name) : null,
    };
  };
  /** a leaf's text, where it is written */
  const textAt = (element: XmlElement): RuleLocation => {
    const start = text.indexOf('>', element.from) + 1;
    const end = text.lastIndexOf('</', element.to);
    const raw = text.slice(start, end);
    const from = start + raw.indexOf(raw.trim());
    return { document, from, to: from + raw.trim().length };
  };
  const refer = (
    kind: string,
    name: string,
    location: RuleLocation,
    owner?: string,
  ) => {
    const id = `w${counter++}`;
    facts.references.push({
      kinds: [kind],
      name,
      location,
      id,
      ...(owner && { scope: { owner } }),
    });
    return id;
  };
  const rootTags = tags(root);
  facts.definitions.push({
    id: `world.root:${root.name}`,
    kind: 'world.root',
    name: root.name,
    location: rootTags.open,
  });
  if (rootTags.close) refer('world.root', root.name, rootTags.close);
  const classes = new Set<string>();
  const attributes = new Set<string>();
  /** an entity: its tag its class, its children its attributes (an attribute may hold entities) */
  const entity = (element: XmlElement) => {
    const classId = `world.class:${element.name}`;
    const { open, close } = tags(element);
    if (classes.has(element.name)) refer('world.class', element.name, open);
    else {
      classes.add(element.name);
      facts.definitions.push({
        id: classId,
        kind: 'world.class',
        name: element.name,
        location: open,
      });
    }
    if (close) refer('world.class', element.name, close);
    for (const child of element.children) {
      const attributeId = `world.attribute:${element.name}/${child.name}`;
      const tag = tags(child);
      // `<objects><Object>…</Object></objects>`: a sequence of entities
      const [nested] = child.children;
      if (attributes.has(attributeId))
        refer('world.attribute', child.name, tag.open, classId);
      else {
        attributes.add(attributeId);
        facts.definitions.push({
          id: attributeId,
          kind: 'world.attribute',
          name: child.name,
          location: tag.open,
          owner: classId,
          ...(nested && { type: `Sequence(${nested.name})` }),
        });
      }
      if (tag.close) refer('world.attribute', child.name, tag.close, classId);
      child.children.forEach(entity);
      if (!child.text) continue;
      if (child.name === 'name')
        facts.definitions.push({
          id: `world.instance:${child.text}`,
          kind: 'world.instance',
          name: child.text,
          location: textAt(child),
          owner: classId,
        });
      else {
        const value = refer('world.value', child.text, textAt(child));
        relations.push(
          ['world_attrValue', attributeId, child.text],
          ['world_valueKind', attributeId, valueKind(child.text)],
          ['world_valueRef', ref(value)],
        );
      }
    }
  };
  root.children.forEach(entity);
  return facts;
};
