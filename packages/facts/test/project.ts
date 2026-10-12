/** A project of examples/projects (or a copy of one): its documents, as the workbench holds them. */
import * as fs from 'fs';
import * as path from 'path';
import { parsePistar } from '@istar-ts/core';
import type { AnyDialect } from '@goal-controller/dialect';
import { goalView, type GoalView } from '@goal-controller/goal-tree';
import { edgeV2, goda, mutrose } from '@goal-controller/lib';
import { FactPool, poolFor } from '../src';
import type { PoolDocument } from '../src/core/types';

export const ROOT = path.join(__dirname, '..', '..', '..');

export const DIALECTS: Record<string, AnyDialect> = {
  mutrose: mutrose as AnyDialect,
  edgev2: edgeV2 as AnyDialect,
  goda: goda as AnyDialect,
};

export type ProjectFiles = Record<string, string>;

/** Every file of a project directory, by its path in it. */
export const readProject = (dir: string): ProjectFiles => {
  const files: ProjectFiles = {};
  const walk = (at: string) => {
    for (const entry of fs.readdirSync(path.join(dir, at), {
      withFileTypes: true,
    })) {
      const relative = at ? `${at}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(relative);
      else files[relative] = fs.readFileSync(path.join(dir, relative), 'utf8');
    }
  };
  walk('');
  return files;
};

type Manifest = {
  dialect: string;
  models: { path: string }[];
  projectResources?: Record<string, string | string[]>;
};

/** A model's view, as the workbench reads it. */
export const viewOf = (definition: AnyDialect, modelText: string) =>
  goalView(parsePistar(JSON.parse(modelText)), definition);

/** The pool's documents of a project: its first model's view, and its resources. */
export const documentsOf = (files: ProjectFiles) => {
  const manifest = JSON.parse(files['project.json']!) as Manifest;
  const definition = DIALECTS[manifest.dialect]!;
  const documents: PoolDocument[] = [
    {
      id: 'model',
      kind: 'model',
      value: viewOf(definition, files[manifest.models[0]!.path]!),
    },
    ...Object.entries(manifest.projectResources ?? {}).flatMap(
      ([kind, paths]) =>
        (Array.isArray(paths) ? paths : [paths]).map((p) => ({
          id: p,
          kind,
          text: files[p] ?? '',
        })),
    ),
  ];
  return { definition, documents };
};

export const exampleProject = (name: string) =>
  readProject(path.join(ROOT, 'examples', 'projects', name));

/** Documents with some elements' properties set (a property set to '' is removed). */
export const withProperties = (
  documents: readonly PoolDocument[],
  edits: Record<string, Record<string, string>>,
): PoolDocument[] =>
  documents.map((document) => {
    if (document.kind !== 'model') return document;
    const view = document.value as GoalView;
    const nodes = new Map(
      [...view.nodes].map(([key, node]) => {
        const edit = edits[key];
        if (!edit) return [key, node];
        const properties = { ...node.properties, ...edit };
        for (const [k, v] of Object.entries(edit))
          if (v === '') delete properties[k];
        return [key, { ...node, properties }];
      }),
    );
    return { ...document, value: { ...view, nodes } };
  });

/** A project's pool, its documents in. */
export const poolOf = (files: ProjectFiles) => {
  const { definition, documents } = documentsOf(files);
  const pool = new FactPool(poolFor(definition)!);
  pool.update(documents);
  return { pool, documents, definition };
};

/** A project's diagnostics, located as the #59 oracle writes them (file, element, field, text). */
export const oracleDiagnostics = (dir: string) => {
  const files = readProject(dir);
  const { pool, documents } = poolOf(files);
  const kinds = Object.fromEntries(documents.map((d) => [d.id, d.kind]));
  return pool.diagnostics().map(({ location, severity, code }) => {
    const model = /^model:(.*):([^:]*)$/.exec(location.document);
    return {
      file: model ? 'model' : kinds[location.document]!,
      ...(model && { element: model[1]!, field: model[2]! }),
      text: pool.textOf(location.document)!.slice(location.from, location.to),
      severity,
      code,
    };
  });
};
