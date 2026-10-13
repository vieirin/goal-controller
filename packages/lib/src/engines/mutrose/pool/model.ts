/**
 * MutRoSe's goal model in the definition pool (goal-controller#59): its
 * goals and abstract tasks, the variables Controls and queries declare, and
 * what refers to the other files: a task's first word is an HDDL task, a
 * type is a world class, `name.attr` is an attribute of name's class. Each
 * element's field is a document of its own (`model:AT1:Params`), so a
 * location doesn't depend on how a view lays the model out. Its OCL is read
 * with MutRoSe's OCL grammar (goal-controller#62).
 */
import type { DocumentNode, DocumentTree } from '@goal-controller/dialect';
import { readOclExpression, readOclVariables, type OclName } from '../language';
import type {
  PoolCompletion,
  PoolDefinition,
  PoolDocument,
  PoolFacts,
  PoolLookup,
  PoolProvider,
  PoolReference,
} from '../../definitionPool';

const PROVIDER = 'gm';

/** OCL's own types: no world class */
export const BASIC_TYPES = new Set(['Integer', 'Real', 'Boolean', 'String']);

/** A model field's document id. */
export const modelDocument = (element: string, field: string) =>
  `model:${element}:${field}`;

/** The element and field of a model document id (null: not the model's). */
export const modelField = (
  document: string,
): { element: string; field: string } | null => {
  const match = /^model:(.*):([^:]*)$/.exec(document);
  return match ? { element: match[1]!, field: match[2]! } : null;
};

/** The model's nodes, as a provider gets them (goal-tree's GoalView is one). */
export const modelNodes = (
  document: PoolDocument,
): [string, DocumentNode][] => {
  const tree = document.value as DocumentTree | undefined;
  return tree ? [...tree.nodes.entries()] : [];
};

/** The OCL text of a property, and where it starts in the value (a condition's, inside its quotes). */
export const oclOf = (
  key: string,
  value: string,
): { text: string; offset: number } | null => {
  if (key === 'QueriedProperty' || key === 'AchieveCondition')
    return { text: value, offset: 0 };
  if (key === 'CreationCondition') {
    const match = /^(\s*assertion\s+condition\s+")([^"]*)"/i.exec(value);
    return match ? { text: match[2]!, offset: match[1]!.length } : null;
  }
  return null;
};

const extract = (document: PoolDocument): PoolFacts => {
  const definitions: PoolDefinition[] = [];
  const references: PoolReference[] = [];
  const declared = new Set<string>();
  const at = (key: string, field: string, from: number, to: number) => ({
    document: modelDocument(key, field),
    from,
    to,
  });
  const nodes = modelNodes(document);
  for (const [key, node] of nodes) {
    if (node.kind !== 'goal' && node.kind !== 'task') continue;
    const self: PoolDefinition = {
      id: `${PROVIDER}.${node.kind}:${node.id}`,
      kind: `${PROVIDER}.${node.kind}`,
      name: node.id,
      location: at(key, 'id', 0, node.id.length),
      detail: node.name,
    };
    definitions.push(self);
    const props = node.properties;
    const variable = (
      name: OclName,
      field: string,
      owner: string,
    ): PoolReference => ({
      kinds: [`${PROVIDER}.variable`],
      name: name.name,
      location: at(key, field, name.from, name.to),
      scope: { owner },
    });
    // MutRoSe's property checks say a type the world has no class for
    const worldClass = (name: OclName, field: string) => {
      if (!BASIC_TYPES.has(name.name))
        references.push({
          kinds: ['world.class'],
          name: name.name,
          location: at(key, field, name.from, name.to),
          silent: true,
        });
    };
    if (node.kind === 'task') {
      // its first word: the HDDL task it stands for
      const word = /\S+/.exec(node.name);
      if (word)
        references.push({
          kinds: ['hddl.task'],
          name: word[0],
          location: at(key, 'name', word.index, word.index + word[0].length),
        });
    }
    // Controls declares the model's variables; a second declaration is a use
    for (const { name, type, typeName } of readOclVariables(
      props.Controls ?? '',
    ).value) {
      if (declared.has(name.name))
        references.push(variable(name, 'Controls', self.id));
      else {
        declared.add(name.name);
        definitions.push({
          id: `${PROVIDER}.variable:${name.name}`,
          kind: `${PROVIDER}.variable`,
          name: name.name,
          location: at(key, 'Controls', name.from, name.to),
          type: type.replace(/\s+/g, ''),
          detail: `declared by ${node.id}`,
        });
      }
      if (typeName) worldClass(typeName, 'Controls');
    }
    for (const field of ['Monitors', 'Params', 'Location'])
      for (const { name } of readOclVariables(props[field] ?? '').value)
        references.push(variable(name, field, self.id));
    for (const [field, value] of Object.entries(props)) {
      const ocl = oclOf(field, value);
      if (!ocl) continue;
      // read with MutRoSe's OCL grammar (goal-language's OclExpression)
      const reading = readOclExpression(ocl.text, ocl.offset).value;
      // a query's variable is its own: looked up in the goal first
      for (const select of reading.selects) {
        definitions.push({
          id: `${PROVIDER}.variable:${self.id}/${select.variable.name}`,
          kind: `${PROVIDER}.variable`,
          name: select.variable.name,
          location: at(key, field, select.variable.from, select.variable.to),
          owner: self.id,
          type: select.type.name,
          detail: `${node.id}'s query variable`,
        });
        worldClass(select.type, field);
      }
      for (const forAll of reading.forAlls)
        references.push(variable(forAll.iteration, field, self.id));
      for (const path of reading.paths) {
        let previous = variable(path.head, field, self.id);
        references.push(previous);
        for (const attribute of path.attributes) {
          const next: PoolReference = {
            kinds: ['world.attribute'],
            name: attribute.name,
            location: at(key, field, attribute.from, attribute.to),
            scope: { via: previous, through: 'type' },
          };
          references.push(next);
          previous = next;
        }
      }
    }
  }
  return { definitions, references };
};

const complete = (
  pool: PoolLookup,
  document: PoolDocument,
  offset: number,
): PoolCompletion[] => {
  const field = modelField(document.id);
  if (field?.field !== 'name') return [];
  const node = modelNodes(document).find(([key]) => key === field.element)?.[1];
  // a task's first word: the domain's tasks
  if (node?.kind !== 'task') return [];
  const word = /^\S*/.exec(node.name)![0];
  if (offset > word.length) return [];
  return pool.definitionsOf('hddl.task').map((task) => ({
    label: task.name,
    kind: task.kind,
    detail: task.detail,
    from: 0,
    to: word.length,
  }));
};

export const modelProvider: PoolProvider = {
  id: PROVIDER,
  documents: { model: true },
  kinds: {
    goal: { label: 'Goal' },
    task: { label: 'Abstract task' },
    variable: { label: 'Variable' },
  },
  refers: ['hddl.task', 'world.class', 'world.attribute'],
  extract,
  complete,
  // ids are the diagram's (and the runtime annotation's): not renamed here
  renameText: (definition, newName) =>
    definition.kind === 'gm.variable' && /^[A-Za-z][A-Za-z0-9_]*$/.test(newName)
      ? newName
      : null,
};
