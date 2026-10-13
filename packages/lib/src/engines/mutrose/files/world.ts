/**
 * MutRoSe's world knowledge (`knowledge/*.xml`): under the root, each
 * entity's tag is its class and its children (and XML attributes) its
 * attributes. A class and an attribute are defined by their first tag; the
 * other tags (closing ones too) refer to them, so renaming one renames
 * them all. An entity's `<name>` defines an instance; an attribute whose
 * value is an instance's name refers to it. A child with entities in it is
 * a collection: its entities are read as the root's are.
 */
import * as z from 'zod/mini';
import { defineFile, xml, type NamePart, type Occurrence } from '../../../pool';
import { defines, refersTo } from '../pool/vocabulary';

/** An element, as the XML parser gives it. */
type Element = {
  name: string;
  attributes: Record<string, string>;
  children: Element[];
  text?: string;
};

/** The world's instances by name, and their classes: the entities' `<name>`s. */
const instancesOf = (root: unknown) => {
  const classes = new Map<string, string>();
  const entity = (element: Element): void => {
    const name =
      element.children.find((child) => child.name === 'name')?.text ??
      element.attributes.name;
    if (name && !classes.has(name)) classes.set(name, element.name);
    for (const child of element.children)
      child.children.filter((c) => c.children.length).forEach(entity);
  };
  (root as Element | undefined)?.children.forEach(entity);
  return classes;
};

/**
 * An attribute's type, from its values: OCL's, the class their instances
 * are of, or `Sequence(Class)` for a collection of one class's entities.
 */
const attributeType = (
  occurrences: readonly Occurrence[],
  root: unknown,
): string => {
  const values: string[] = [];
  const collected = new Set<string>();
  // its tags and its XML attributes: one value each (a closing tag is its opening one's)
  for (const element of new Set(occurrences.map((o) => o.parent))) {
    const occurrence = occurrences.find((o) => o.parent === element)!;
    const field = element as Element | Record<string, string>;
    if ('children' in field && Array.isArray(field.children)) {
      const nested = (field as Element).children.filter(
        (c) => c.children.length,
      );
      nested.forEach((entity) => collected.add(entity.name));
      if ((field as Element).text !== undefined)
        values.push((field as Element).text!);
    } else
      values.push(
        (field as Record<string, string>)[occurrence.value as string]!,
      );
  }
  const [only, ...others] = collected;
  if (only && !others.length) return `Sequence(${only})`;
  if (!values.length) return 'String';
  if (values.every((v) => /^(true|false)$/i.test(v))) return 'Boolean';
  if (values.every((v) => /^-?\d+$/.test(v))) return 'Integer';
  if (values.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return 'Real';
  const instances = instancesOf(root);
  const classes = new Set(values.map((v) => instances.get(v)));
  const [one] = classes;
  return classes.size === 1 && one ? one : 'String';
};

/** a value that may be an instance's name: not a boolean, not a number */
const maybeInstance: NamePart = (text) =>
  /^(true|false|-?\d+(\.\d+)?)$/i.test(text) ? null : { text, offset: 0 };

const tag = z.string().check(defines('world.class', { firstUse: true }));
/** an attribute of the entity it is in */
const attributeTag = (schema: z.ZodMiniString | z.ZodMiniLiteral<string>) =>
  schema.check(
    defines('world.attribute', {
      firstUse: true,
      owner: '../name',
      type: attributeType,
    }),
  );

/** an entity: `nested`, in a collection (it has children of its own) */
const entity = (nested: boolean): z.ZodMiniType =>
  z.lazy(() =>
    z.looseObject({
      name: tag,
      close: z.optional(tag),
      attributes: z.record(attributeTag(z.string()), z.string()),
      children: nested
        ? z.array(z.union([instanceName, field])).check(z.minLength(1))
        : z.array(z.union([instanceName, field])),
    }),
  );

/** `<name>`: the entity is an instance of its class, named so */
const instanceName = z.looseObject({
  name: attributeTag(z.literal('name')),
  close: z.optional(attributeTag(z.literal('name'))),
  text: z.optional(
    z.string().check(defines('world.instance', { type: '../name' })),
  ),
});

/** an attribute: a value (maybe an instance's name), or a collection of entities */
const field = z.looseObject({
  name: attributeTag(z.string()),
  close: z.optional(attributeTag(z.string())),
  children: z.array(z.union([entity(true), z.unknown()])),
  text: z.optional(
    z.string().check(
      refersTo('world.instance', undefined, {
        name: maybeInstance,
        unresolved: false,
      }),
    ),
  ),
});

export const world = defineFile({
  kind: 'world',
  parser: xml,
  schema: z.looseObject({
    name: z.string(),
    children: z.array(entity(false)),
  }),
});
