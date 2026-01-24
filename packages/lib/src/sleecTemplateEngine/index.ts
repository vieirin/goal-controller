import type { GoalNode, GoalTree } from '../GoalTree/types';
import { allByType } from '../GoalTree/utils';

const renameTaskId = (id: string) => id.replace('.', '_');

const taskFluentName = (
  task: GoalNode,
  op: 'Start' | 'Pursuing' | 'Achieved' | 'ReportFailure',
) => {
  return `${op}${task.properties.FluentName}`;
};

const fluentOperations = [
  'Start',
  'Pursuing',
  'Achieved',
  'ReportFailure',
] as const;

export type MeasureType = 'boolean' | 'scale';

export type Measure = {
  name: string;
  type: MeasureType;
};

/**
 * Extracts measures (variables) from task conditions.
 * Variables in {name} format that are used with = value are scales,
 * otherwise they are booleans.
 */
export const extractMeasures = (tasks: GoalNode[]): Measure[] => {
  const measures = new Map<string, MeasureType>();

  // Regex to find variables in {variableName} format
  const variableRegex = /\{(\w+)\}/g;
  // Regex to find scale comparisons: {variableName} = value
  const scaleRegex = /\{(\w+)\}\s*=\s*(\w+)/g;

  for (const task of tasks) {
    const conditions = [
      task.properties.PreCond,
      task.properties.PostCond,
    ].filter(Boolean) as string[];

    for (const condition of conditions) {
      // First, find all scale variables (those with = value)
      let scaleMatch;
      while ((scaleMatch = scaleRegex.exec(condition)) !== null) {
        const varName = scaleMatch[1];
        if (varName) {
          measures.set(varName, 'scale');
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
    .map(([name, type]) => ({ name, type }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Extracts external triggering events from tasks (e.g., MeetingUser, PatientAsleep)
 */
const extractTriggeringEvents = (tasks: GoalNode[]): Set<string> =>
  new Set(
    tasks
      .map((task) => task.properties.TriggeringEvent)
      .filter((event): event is string => !!event),
  );

/**
 * Generates fluent-based events for each task (Start/Pursuing/Achieved/ReportFailure)
 */
const extractFluentEvents = (tasks: GoalNode[]): Set<string> =>
  new Set(
    tasks
      .filter((task) => task.properties.FluentName)
      .flatMap((task) =>
        fluentOperations.map((op) => `${op}${task.properties.FluentName}`),
      ),
  );

/**
 * Extracts fluent names from tasks
 */
const extractFluentNames = (tasks: GoalNode[]): string[] =>
  tasks
    .map((task) => task.properties.FluentName)
    .filter((name): name is string => !!name)
    .filter((name, index, self) => self.indexOf(name) === index)
    .sort();

/**
 * Extracts events that other tasks avoid (from AvoidEvent property)
 * The AvoidEvent value already includes the full event name (e.g., AchievedObtainConsentPartialTracking)
 */
const extractAvoidEvents = (tasks: GoalNode[]): Set<string> =>
  new Set(
    tasks
      .map((task) => `Achieved${task.properties.AvoidEvent}`)
      .filter((event): event is string => !!event),
  );

const eventLine = (event: string): string => `    event ${event}`;
const measureLine = (measure: Measure): string =>
  measure.type === 'scale'
    ? `    measure ${measure.name}: scale(low, moderate, high)`
    : `    measure ${measure.name}: boolean`;

/**
 * Generates the def_start section with all events and measures
 */
const generateDefinitions = (tasks: GoalNode[]): string => {
  const triggeringEvents = extractTriggeringEvents(tasks);
  const fluentEvents = extractFluentEvents(tasks);
  const avoidEvents = extractAvoidEvents(tasks);
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
  const additionalAvoidEventLines = Array.from(avoidEvents)
    .filter((event) => !fluentEvents.has(event))
    .sort()
    .map(eventLine);

  // Measure definitions
  const measureLines = measures.map(measureLine);

  // Combine all sections with empty line separators between them
  const sections = [
    externalEventLines,
    fluentEventLines,
    additionalAvoidEventLines,
    measureLines,
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

const generateTaskRules = (tasks: GoalNode[]): string => {
  const hasAvoidEvents = (task: GoalNode) => !!task.properties.AvoidEvent;
  return `rule_start
      ${tasks
        .map((task) => {
          return `
      Rule${renameTaskId(task.id)}_1 when ${
        task.properties.TriggeringEvent
      } and ${task.properties.PreCond} then ${taskFluentName(task, 'Start')}
      Rule${renameTaskId(task.id)}_2 when ${taskFluentName(
        task,
        'Start',
      )} then ${taskFluentName(task, 'Pursuing')} within ${
        task.properties.TemporalConstraint
      }
      Rule${renameTaskId(task.id)}_3 when ${taskFluentName(
        task,
        'Pursuing',
      )} and ${task.properties.PostCond} then ${taskFluentName(
        task,
        'Achieved',
      )} unless (not ${task.properties.PostCond}) then ${taskFluentName(
        task,
        'ReportFailure',
      )} 
      ${hasAvoidEvents(task) ? generateAvoidEventsRules(task) : ''}`;
        })
        .join('\n')}
rule_end`;
};

function generateAvoidEventsRules(task: GoalNode): string {
  return `Rule${renameTaskId(task.id)}_4 when Achieved${task.properties.AvoidEvent} then not ${taskFluentName(task, 'Pursuing')}`;
}

export const sleecTemplateEngine = (tree: GoalTree): string => {
  const tasks = allByType({ gm: tree, type: 'task' });
  const definitions = generateDefinitions(tasks);
  const rules = generateTaskRules(tasks);
  return `${definitions}

${rules}`;
};
