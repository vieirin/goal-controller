/**
 * MutRoSe's configuration (`configuration/configuration.json`): where the
 * world knowledge is, which world classes are locations, and how the goal
 * model's types and variables map onto the HDDL domain's.
 */
import {
  keyRange,
  readJson,
  type ParsedResource,
  type ProjectResourceParser,
  type ResourceDiagnostic,
} from '../../projectResources';

export type MutroseConfiguration = {
  /** the world knowledge's file and root element, as the configuration names them */
  worldDb?: { path?: string; xmlRoot?: string };
  /** the world classes a task's Location may be */
  locationTypes: string[];
  /** HDDL type ↔ OCL type (a world class) */
  typeMapping: { hddlType: string; oclType: string }[];
  /** per abstract task: the model's variable ↔ the HDDL task's parameter */
  varMapping: { taskId: string; map: { gmVar: string; hddlVar: string }[] }[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export const parseConfiguration: ProjectResourceParser<MutroseConfiguration> = (
  files,
): ParsedResource<MutroseConfiguration> => {
  const configuration: MutroseConfiguration = {
    locationTypes: [],
    typeMapping: [],
    varMapping: [],
  };
  const [file] = files;
  if (!file) return { symbols: {}, data: configuration, diagnostics: [] };
  const { value, diagnostics } = readJson(file);
  const problem = (key: string, message: string): ResourceDiagnostic => ({
    path: file.path,
    severity: 'error',
    message,
    ...keyRange(file.text, key),
  });
  if (value !== undefined && !isRecord(value))
    diagnostics.push(problem('', 'A configuration is a JSON object'));
  if (isRecord(value)) {
    const world = value.world_db;
    if (isRecord(world))
      configuration.worldDb = {
        ...(str(world.path) && { path: str(world.path) }),
        ...(str(world.xml_root) && { xmlRoot: str(world.xml_root) }),
      };
    const locations = value.location_types;
    if (locations !== undefined) {
      if (
        Array.isArray(locations) &&
        locations.every((l) => typeof l === 'string')
      )
        configuration.locationTypes = locations;
      else
        diagnostics.push(
          problem(
            'location_types',
            '`location_types` is a list of world classes',
          ),
        );
    }
    const types = value.type_mapping;
    if (types !== undefined) {
      if (Array.isArray(types))
        for (const mapping of types) {
          const hddlType = isRecord(mapping)
            ? str(mapping.hddl_type)
            : undefined;
          const oclType = isRecord(mapping) ? str(mapping.ocl_type) : undefined;
          if (hddlType && oclType)
            configuration.typeMapping.push({ hddlType, oclType });
          else
            diagnostics.push(
              problem(
                'type_mapping',
                'Each `type_mapping` entry is `{ "hddl_type": …, "ocl_type": … }`',
              ),
            );
        }
      else
        diagnostics.push(problem('type_mapping', '`type_mapping` is a list'));
    }
    const vars = value.var_mapping;
    if (vars !== undefined) {
      if (Array.isArray(vars))
        for (const task of vars) {
          const taskId = isRecord(task) ? str(task.task_id) : undefined;
          const map =
            isRecord(task) && Array.isArray(task.map) ? task.map : null;
          if (!taskId || !map) {
            diagnostics.push(
              problem(
                'var_mapping',
                'Each `var_mapping` entry is `{ "task_id": …, "map": [ … ] }`',
              ),
            );
            continue;
          }
          configuration.varMapping.push({
            taskId,
            map: map.flatMap((pair) => {
              const gmVar = isRecord(pair) ? str(pair.gm_var) : undefined;
              const hddlVar = isRecord(pair) ? str(pair.hddl_var) : undefined;
              return gmVar && hddlVar ? [{ gmVar, hddlVar }] : [];
            }),
          });
        }
      else diagnostics.push(problem('var_mapping', '`var_mapping` is a list'));
    }
  }
  return {
    symbols: {
      locationTypes: configuration.locationTypes.map((name) => ({
        name,
        detail: 'location type',
      })),
    },
    data: configuration,
    diagnostics,
  };
};
