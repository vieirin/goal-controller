/**
 * MutRoSe's world knowledge (`knowledge/world_db.xml`): under its root, one
 * element per entity, its tag the entity's class and its children the
 * attributes (`<Room><name>RoomA</name><is_clean>False</is_clean></Room>`).
 * The decomposer queries it (`world_db->select(r:Room | …)`); its classes are
 * the OCL types a goal model may use. Read by its typed reader
 * (readers/world.ts); while it doesn't parse, its last good reading stands.
 */
import { read } from '../../../readers';
import type {
  ParsedResource,
  ProjectResourceParser,
  ResourceDiagnostic,
} from '../../projectResources';
import { nameOf, worldReader } from '../readers/world';

export type WorldClass = {
  /** the attributes its entities have, in the order first seen */
  attributes: string[];
  /** its entities' names (their `name` attribute or child) */
  instances: string[];
};

export type WorldKnowledge = {
  /** the root element's tag (`world_db`) */
  root: string;
  classes: Record<string, WorldClass>;
};

export const parseWorld: ProjectResourceParser<WorldKnowledge> = (
  files,
): ParsedResource<WorldKnowledge> => {
  const [file] = files;
  const world: WorldKnowledge = { root: '', classes: {} };
  if (!file) return { symbols: {}, data: world, diagnostics: [] };
  const {
    value: root,
    facts,
    problems,
    stale,
  } = read(worldReader, file.path, file.text);
  const diagnostics: ResourceDiagnostic[] = [
    ...problems,
    // a stale reading's warnings are where the text was
    ...(stale ? [] : (facts?.warnings ?? [])),
  ].map((problem) => ({ path: file.path, ...problem }));
  if (root) {
    world.root = root.name;
    for (const entity of root.children) {
      const known = (world.classes[entity.name] ??= {
        attributes: [],
        instances: [],
      });
      for (const attribute of [
        ...Object.keys(entity.attributes),
        ...entity.children.map((child) => child.name),
      ])
        if (!known.attributes.includes(attribute))
          known.attributes.push(attribute);
      const name = nameOf(entity);
      if (name) known.instances.push(name);
    }
  }
  return {
    symbols: {
      classes: Object.entries(world.classes).map(([name, known]) => ({
        name,
        detail: `${known.instances.length} in the world`,
        members: known.attributes.map((attribute) => ({
          name: attribute,
          detail: `${name} attribute`,
        })),
      })),
      instances: Object.entries(world.classes).flatMap(([name, known]) =>
        known.instances.map((instance) => ({ name: instance, detail: name })),
      ),
    },
    data: world,
    diagnostics,
  };
};
