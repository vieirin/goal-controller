/**
 * MutRoSe's world knowledge in the definition pool (goal-controller#59):
 * under the root, each entity's tag is its class and its children its
 * attributes. A class and an attribute are defined where first written;
 * their other tags (closing ones too) refer to them, so renaming one
 * renames them all. An entity's name defines an instance; an attribute
 * whose value is an instance's name refers to it.
 */
import type {
  PoolDefinition,
  PoolDocument,
  PoolFacts,
  PoolProvider,
  PoolReference,
} from '../../definitionPool';
import { readXml, type Range, type XmlElement } from '../../../formats/xml';

const PROVIDER = 'world';

/** The type an attribute's values say it has: OCL's, or the class their instances are of. */
const typeOfValues = (
  values: readonly string[],
  classOf: (instance: string) => string | undefined,
): string => {
  if (!values.length) return 'String';
  if (values.every((v) => /^(true|false)$/i.test(v))) return 'Boolean';
  if (values.every((v) => /^-?\d+$/.test(v))) return 'Integer';
  if (values.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return 'Real';
  const classes = new Set(values.map(classOf));
  const [only] = classes;
  return classes.size === 1 && only ? only : 'String';
};

const extract = (document: PoolDocument): PoolFacts => {
  const definitions: PoolDefinition[] = [];
  const references: PoolReference[] = [];
  const { root } = readXml(document.text ?? '');
  if (!root) return { definitions, references };
  const at = (range: Range) => ({ document: document.id, ...range });
  const nameRange = (element: XmlElement): Range => ({
    from: element.from + 1,
    to: element.from + 1 + element.name.length,
  });
  const classes = new Map<string, PoolDefinition>();
  const attributes = new Map<string, PoolDefinition>();
  /** every value of an attribute, and where (its type and its references come from them) */
  const values = new Map<string, { text: string; range: Range }[]>();
  const instanceClass = new Map<string, string>();
  const tags = (element: XmlElement) => [
    nameRange(element),
    ...(element.closeName ? [element.closeName] : []),
  ];

  /** a collection attribute (`<objects><Object>…`): the classes of its entities */
  const collections = new Map<string, Set<string>>();
  const entityOf = (entity: XmlElement): void => {
    const classId = `${PROVIDER}.class:${entity.name}`;
    const [first, ...rest] = tags(entity);
    if (!classes.has(entity.name)) {
      const definition: PoolDefinition = {
        id: classId,
        kind: `${PROVIDER}.class`,
        name: entity.name,
        location: at(first!),
      };
      classes.set(entity.name, definition);
      definitions.push(definition);
    } else
      references.push({
        kinds: [`${PROVIDER}.class`],
        name: entity.name,
        location: at(first!),
      });
    for (const range of rest)
      references.push({
        kinds: [`${PROVIDER}.class`],
        name: entity.name,
        location: at(range),
      });
    // its attributes: XML attributes and children alike
    const fields: {
      name: string;
      ranges: Range[];
      value?: { text: string; range: Range };
    }[] = [
      ...Object.entries(entity.attributeRanges).map(([name, ranges]) => ({
        name,
        ranges: [ranges.name],
        value: { text: entity.attributes[name] ?? '', range: ranges.value },
      })),
      ...entity.children.map((child) => ({
        name: child.name,
        ranges: tags(child),
        ...(child.textRange && {
          value: { text: child.text, range: child.textRange },
        }),
      })),
    ];
    for (const field of fields) {
      const key = `${entity.name}.${field.name}`;
      const [firstTag, ...otherTags] = field.ranges;
      if (!attributes.has(key)) {
        const definition: PoolDefinition = {
          id: `${PROVIDER}.attribute:${classId}/${field.name}`,
          kind: `${PROVIDER}.attribute`,
          name: field.name,
          location: at(firstTag!),
          owner: classId,
        };
        attributes.set(key, definition);
        definitions.push(definition);
      } else otherTags.unshift(firstTag!);
      for (const range of otherTags)
        references.push({
          kinds: [`${PROVIDER}.attribute`],
          name: field.name,
          location: at(range),
          scope: { owner: classId },
        });
      if (field.value)
        values.set(key, [...(values.get(key) ?? []), field.value]);
    }
    // a child with entities in it: a collection, its entities read as the root's are
    for (const child of entity.children) {
      const nested = child.children.filter((c) => c.children.length);
      if (!nested.length) continue;
      const key = `${entity.name}.${child.name}`;
      for (const inner of nested) {
        collections.set(
          key,
          (collections.get(key) ?? new Set()).add(inner.name),
        );
        entityOf(inner);
      }
    }
    // its name: an instance of its class
    const name = fields.find((field) => field.name === 'name')?.value;
    if (name?.text) {
      definitions.push({
        id: `${PROVIDER}.instance:${name.text}`,
        kind: `${PROVIDER}.instance`,
        name: name.text,
        location: at(name.range),
        // its class is its type: instances are named across the world
        type: entity.name,
        detail: `${entity.name} instance`,
      });
      instanceClass.set(name.text, entity.name);
    }
  };
  root.children.forEach(entityOf);
  // an attribute's type, from its values; a value naming an instance refers to it
  for (const [key, attribute] of attributes) {
    const written = values.get(key) ?? [];
    const [collected, ...others] = collections.get(key) ?? [];
    attribute.type =
      collected && !others.length
        ? `Sequence(${collected})`
        : typeOfValues(
            written.map((v) => v.text),
            (instance) => instanceClass.get(instance),
          );
    attribute.detail = `${attribute.type} attribute of ${key.split('.')[0]}`;
    if (!key.endsWith('.name'))
      for (const value of written)
        if (instanceClass.has(value.text))
          references.push({
            kinds: [`${PROVIDER}.instance`],
            name: value.text,
            location: at(value.range),
          });
  }
  for (const [name, definition] of classes) {
    const count = [...instanceClass.values()].filter((c) => c === name).length;
    definition.detail = `world class, ${count} in the world`;
  }
  return { definitions, references };
};

export const worldProvider: PoolProvider = {
  id: PROVIDER,
  documents: { resources: ['world'] },
  kinds: {
    class: { label: 'World class' },
    attribute: { label: 'World attribute', scope: 'owner' },
    instance: { label: 'World instance' },
  },
  extract,
  // an XML name: a letter or `_`, then letters, digits, `_`, `-`, `.`
  renameText: (_definition, newName) =>
    /^[A-Za-z_][\w.-]*$/.test(newName) ? newName : null,
};
