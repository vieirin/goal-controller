/**
 * MutRoSe's world knowledge (`knowledge/world_db.xml`): under its root, one
 * element per entity, its tag the entity's class and its children the
 * attributes (`<Room><name>RoomA</name><is_clean>False</is_clean></Room>`).
 * The decomposer queries it (`world_db->select(r:Room | …)`); its classes are
 * the OCL types a goal model may use.
 */
import type {
  ParsedResource,
  ProjectResourceParser,
  ResourceDiagnostic,
} from '../../projectResources';
import { readXml, type XmlElement } from './xml';

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

const nameOf = (entity: XmlElement): string | undefined =>
  entity.attributes.name ??
  entity.children.find((child) => child.name === 'name')?.text;

export const parseWorld: ProjectResourceParser<WorldKnowledge> = (
  files,
): ParsedResource<WorldKnowledge> => {
  const [file] = files;
  const diagnostics: ResourceDiagnostic[] = [];
  const world: WorldKnowledge = { root: '', classes: {} };
  if (!file) return { symbols: {}, data: world, diagnostics };
  const { root, problems } = readXml(file.text);
  for (const problem of problems)
    diagnostics.push({ path: file.path, severity: 'error', ...problem });
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
      else
        diagnostics.push({
          path: file.path,
          severity: 'warning',
          message: `This ${entity.name} has no name: the decomposer names entities by their \`name\``,
          from: entity.from,
          to: entity.from + entity.name.length + 1,
        });
    }
    if (!root.children.length)
      diagnostics.push({
        path: file.path,
        severity: 'warning',
        message: `<${root.name}> has no entities`,
        from: root.from,
        to: root.from + root.name.length + 1,
      });
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
