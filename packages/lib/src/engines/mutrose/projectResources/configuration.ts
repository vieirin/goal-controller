/**
 * MutRoSe's configuration (`configuration/configuration.json`): where the
 * world knowledge is, which world classes are locations, and how the goal
 * model's types and variables map onto the HDDL domain's. Read by its typed
 * reader (readers/configuration.ts): what is wrong is where it is written.
 */
import { read } from '../../../readers';
import type {
  ParsedResource,
  ProjectResourceParser,
} from '../../projectResources';
import { configurationReader } from '../readers/configuration';

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

export const parseConfiguration: ProjectResourceParser<MutroseConfiguration> = (
  files,
): ParsedResource<MutroseConfiguration> => {
  const [file] = files;
  if (!file)
    return {
      symbols: {},
      data: { locationTypes: [], typeMapping: [], varMapping: [] },
      diagnostics: [],
    };
  const { value, problems } = read(configurationReader, file.path, file.text);
  const world = value?.world_db;
  const configuration: MutroseConfiguration = {
    ...(world && {
      worldDb: {
        ...(world.path && { path: world.path }),
        ...(world.xml_root && { xmlRoot: world.xml_root }),
      },
    }),
    locationTypes: value?.location_types ?? [],
    typeMapping: (value?.type_mapping ?? []).map((mapping) => ({
      hddlType: mapping.hddl_type,
      oclType: mapping.ocl_type,
    })),
    varMapping: (value?.var_mapping ?? []).map((task) => ({
      taskId: task.task_id,
      map: task.map.map((pair) => ({
        gmVar: pair.gm_var,
        hddlVar: pair.hddl_var,
      })),
    })),
  };
  return {
    symbols: {
      locationTypes: configuration.locationTypes.map((name) => ({
        name,
        detail: 'location type',
      })),
    },
    data: configuration,
    diagnostics: problems.map((problem) => ({ path: file.path, ...problem })),
  };
};
