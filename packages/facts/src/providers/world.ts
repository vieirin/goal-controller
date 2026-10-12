/**
 * MutRoSe's world knowledge (`knowledge/world_db.xml`): under its root, one
 * element per entity, its tag its class and its children its attributes.
 * The first tag of a class or of a class's attribute defines it; every later
 * one (closing tags too) refers to it, so a rename renames them all. An
 * attribute holding entities (`<objects><Object>…`) is a sequence of them. An
 * attribute's type is inferred by rules from its values: a class when every
 * value names an instance of it, else Boolean, Integer, Real or String.
 */
import {
  readXml,
  type XmlElement,
} from '@goal-controller/lib/out/engines/mutrose/projectResources/xml';
import { ref, type PoolFacts, type PoolProvider } from '../core/types';

const valueKind = (value: string) =>
  /^(true|false)$/i.test(value)
    ? 'Boolean'
    : /^-?\d+$/.test(value)
      ? 'Integer'
      : /^-?\d+\.\d+$/.test(value)
        ? 'Real'
        : 'String';

export const worldProvider: PoolProvider = {
  id: 'world',
  documents: { resources: ['world'] },
  kinds: {
    root: { label: 'world root' },
    class: { label: 'world class' },
    attribute: { label: 'attribute', scope: 'owner' },
    instance: { label: 'world instance' },
    value: { label: 'world instance', scope: 'optional' },
  },
  refers: ['world.class', 'world.attribute', 'world.root', 'world.value'],
  extract: ({ id: document, text = '' }) => {
    const facts: Required<PoolFacts> = {
      definitions: [],
      references: [],
      relations: [],
    };
    const { root } = readXml(text);
    if (!root) return facts;
    let counter = 0;
    const at = (from: number, name: string) => ({
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
    const textAt = (element: XmlElement) => {
      const start = text.indexOf('>', element.from) + 1;
      const end = text.lastIndexOf('</', element.to);
      const raw = text.slice(start, end);
      const from = start + raw.indexOf(raw.trim());
      return { document, from, to: from + raw.trim().length };
    };
    const refer = (
      kind: string,
      name: string,
      location: { document: string; from: number; to: number },
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
            detail: element.name,
          });
        else {
          const value = refer('world.value', child.text, textAt(child));
          facts.relations.push(
            ['world.attrValue', attributeId, child.text],
            ['world.valueKind', attributeId, valueKind(child.text)],
            ['world.valueRef', ref(value)],
          );
        }
      }
    };
    root.children.forEach(entity);
    return facts;
  },
  rules: `
    world.instanceOf(V, C) :- defines(I, 'world.instance', V), owns(C, I).
    world.hasInstance(C) :- owns(C, I), defines(I, 'world.instance', _).
    % a value naming an instance refers to it
    resolves(R, I) :- refers(R, 'world.value', N), defines(I, 'world.instance', N).
    % an attribute is of a class when every value names one of its instances
    world.candidate(A, C) :- world.attrValue(A, V), world.instanceOf(V, C).
    world.notAll(A, C) :- world.candidate(A, C), world.attrValue(A, V), !world.instanceOf(V, C).
    world.ofClass(A, T) :- world.candidate(A, C), !world.notAll(A, C), defines(C, 'world.class', T).
    world.classTyped(A) :- world.ofClass(A, _).
    % else of its values' kind, when they agree
    world.mixed(A) :- world.valueKind(A, K1), world.valueKind(A, K2), K1 < K2.
    world.basic(A, K) :- world.valueKind(A, K), !world.mixed(A), !world.classTyped(A).
    typeOf(A, T) :- world.ofClass(A, T).
    typeBase(A, T) :- world.ofClass(A, T).
    typeOf(A, K) :- world.basic(A, K).
    typeBase(A, K) :- world.basic(A, K).
  `,
};
