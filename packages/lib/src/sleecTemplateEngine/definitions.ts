import type { Task } from '@goal-controller/goal-tree';
import type { SleecTaskProps } from './types';

type SleecTask = Task<SleecTaskProps>;
import { generateFluents } from './fluents';
import {
  fluentOperations,
  getFluentName,
  taskFluentName,
  type Measure,
  type MeasureType,
} from './shared';

/**
 * Sorts scale values semantically based on common patterns (low → moderate → high).
 * Detects patterns like: *_low/*_moderate/*_high, *_min/*_med/*_max, *_l/*_m/*_h.
 * Falls back to alphabetical sort if no pattern is detected.
 */
const semanticSortScaleValues = (values: string[]): string[] => {
  // Define tier patterns (in order: low, medium, high)
  const lowPatterns = ['low', 'l', 'min', 'minimum', 'small', 'weak'];
  const mediumPatterns = [
    'moderate',
    'med',
    'medium',
    'm',
    'normal',
    'average',
  ];
  const highPatterns = ['high', 'h', 'max', 'maximum', 'large', 'strong'];

  // Extract suffix after last underscore or match entire lowercase value
  const getSuffix = (value: string): string => {
    const parts = value.toLowerCase().split('_');
    return parts[parts.length - 1] || '';
  };

  // Determine tier of a value (0=low, 1=medium, 2=high, -1=unknown)
  const getTier = (value: string): number => {
    const suffix = getSuffix(value);
    if (lowPatterns.includes(suffix)) return 0;
    if (mediumPatterns.includes(suffix)) return 1;
    if (highPatterns.includes(suffix)) return 2;
    return -1;
  };

  // Check if all values have recognized tiers
  const tiers = values.map((v) => getTier(v));
  const hasUnknownTier = tiers.includes(-1);

  if (hasUnknownTier) {
    // Fall back to alphabetical sort
    return [...values].sort();
  }

  // Sort by tier (semantic ordering)
  return [...values].sort((a, b) => getTier(a) - getTier(b));
};

/**
 * Extracts measures (variables) from task conditions.
 * Variables in {name} format that are used with = value are scales,
 * otherwise they are booleans.
 */
export const extractMeasures = (tasks: SleecTask[]): Measure[] => {
  const measures = new Map<string, MeasureType>();
  const scaleValuesMap = new Map<string, Set<string>>();

  // Regex to find variables in {variableName} format
  const variableRegex = /\{(\w+)\}/g;
  // Regex to find scale comparisons: {variableName} = value
  const scaleRegex = /\{(\w+)\}\s*=\s*(\w+)/g;

  for (const task of tasks) {
    const conditions = [
      task.properties.engine?.PreCond,
      task.properties.engine?.PostCond,
    ].filter(Boolean) as string[];

    for (const condition of conditions) {
      // First, find all scale variables (those with = value) and collect their values
      let scaleMatch;
      while ((scaleMatch = scaleRegex.exec(condition)) !== null) {
        const varName = scaleMatch[1];
        const value = scaleMatch[2];
        if (varName && value) {
          measures.set(varName, 'scale');
          if (!scaleValuesMap.has(varName)) {
            scaleValuesMap.set(varName, new Set());
          }
          scaleValuesMap.get(varName)?.add(value);
        }
      }

      // Then find all variables and mark as boolean if not already a scale
      let varMatch;
      while ((varMatch = variableRegex.exec(condition)) !== null) {
        const varName = varMatch[1];
        if (varName && !measures.has(varName)) {
          measures.set(varName, 'boolean');
        }
      }
    }
  }

  // Convert to array and sort
  return Array.from(measures.entries())
    .map(([name, type]) => {
      if (type === 'scale') {
        const values = scaleValuesMap.get(name);
        if (!values || values.size === 0) {
          throw new Error(
            `Scale measure "${name}" was detected but no values could be extracted. ` +
              `Ensure scale variables are used with format: {${name}} = value`,
          );
        }
        const sortedValues = semanticSortScaleValues(Array.from(values));
        return { name, type, scaleValues: sortedValues };
      }
      return { name, type };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Extracts external triggering events from tasks (e.g., MeetingUser, PatientAsleep)
 */
const extractTriggeringEvents = (tasks: SleecTask[]): Set<string> =>
  new Set(
    tasks
      .map((task) => task.properties.engine?.TriggeringEvent)
      .filter((event): event is string => !!event),
  );

/**
 * Generates fluent-based events for each task (Start/Pursuing/Achieved/ReportFailure)
 */
const extractFluentEvents = (tasks: SleecTask[]): Set<string> =>
  new Set(
    tasks
      .filter((task) => task.name)
      .flatMap((task) =>
        fluentOperations.map((op) => taskFluentName(task, op)),
      ),
  );

/**
 * Extracts fluent names from tasks
 */
const extractFluentNames = (tasks: SleecTask[]): string[] =>
  tasks
    .map((task) => getFluentName(task))
    .filter((name): name is string => !!name)
    .filter((name, index, self) => self.indexOf(name) === index)
    .sort();

/**
 * Extracts events that other tasks avoid (from ObstacleEvent property)
 * The ObstacleEvent value already includes the full event name (e.g., AchievedObtainConsentPartialTracking)
 */
const extractObstacleEvents = (tasks: SleecTask[]): Set<string> =>
  new Set(
    tasks
      .map((task) => `Achieved${task.properties.engine?.ObstacleEvent}`)
      .filter((event): event is string => !!event),
  );

const eventLine = (event: string): string => `    event ${event}`;
const measureLine = (measure: Measure): string =>
  measure.type === 'scale' && measure.scaleValues
    ? `    measure ${measure.name}: scale(${measure.scaleValues.join(', ')})`
    : `    measure ${measure.name}: boolean`;

/**
 * Generates the def_start section with all events and measures
 */
export const generateDefinitions = (tasks: SleecTask[]): string => {
  const triggeringEvents = extractTriggeringEvents(tasks);
  const fluentEvents = extractFluentEvents(tasks);
  const ObstacleEvents = extractObstacleEvents(tasks);
  const fluentNames = extractFluentNames(tasks);
  const measures = extractMeasures(tasks);

  // External events are triggering events that are NOT fluent events
  const externalEventLines = Array.from(triggeringEvents)
    .filter((event) => !fluentEvents.has(event))
    .sort()
    .map(eventLine);

  // Fluent events grouped by fluent name
  const fluentEventLines = fluentNames.flatMap((fluentName) => [
    ...fluentOperations.map((op) => eventLine(`${op}${fluentName}`)),
    '', // Empty line between fluent groups
  ]);

  // Avoid events not covered by fluent events
  const additionalObstacleEventLines = Array.from(ObstacleEvents)
    .filter((event) => !fluentEvents.has(event))
    .sort()
    .map(eventLine);

  // Measure definitions
  const measureLines = measures.map(measureLine);

  // Fluent definitions (fluent TaskName <{StartTaskName}, {AchievedTaskName}>)
  const fluentLines = generateFluents(tasks);

  // Combine all sections with empty line separators between them
  const sections = [
    externalEventLines,
    fluentEventLines,
    additionalObstacleEventLines,
    measureLines,
    fluentLines,
  ].filter((section) => section.length > 0);

  const lines = sections
    .flatMap((section, index) => {
      const isLastSection = index === sections.length - 1;
      const alreadyEndsWithEmptyLine = section[section.length - 1] === '';
      // Add separator after section unless it's the last one or already has trailing empty line
      return isLastSection || alreadyEndsWithEmptyLine
        ? section
        : [...section, ''];
    })
    .join('\n')
    .replace(/\n+$/, ''); // Remove trailing newlines

  return `def_start
${lines}
def_end`;
};
