/**
 * The pool over MutRoSe-Docs' example projects (a local clone, not in this
 * repository): every goal model with its project's world, domain and
 * configuration, paired as #59's sweep pairs them. Prints each model's
 * diagnostics and unresolved references.
 *
 *   pnpm --filter @goal-controller/facts exec ts-node bench/mutrose-docs.ts /tmp/MutRoSe-Docs
 */
import * as fs from 'fs';
import * as path from 'path';
import { mutrose } from '@goal-controller/lib';
import type { AnyDialect } from '@goal-controller/dialect';
import { FactPool, mutrosePool, type PoolDocument } from '../src';
import { viewOf } from '../test/project';

const root = path.join(process.argv[2] ?? '/tmp/MutRoSe-Docs', 'Examples');
const definition = mutrose as AnyDialect;
const setup = mutrosePool(definition);

const projects = fs
  .readdirSync(root)
  .flatMap((group) =>
    fs
      .readdirSync(path.join(root, group))
      .map((name) => path.join(root, group, name)),
  )
  // a project is a directory with a gm/ (some group their projects one level deeper)
  .flatMap((dir) =>
    fs.existsSync(path.join(dir, 'gm'))
      ? [dir]
      : fs
          .readdirSync(dir)
          .map((name) => path.join(dir, name))
          .filter((d) => fs.existsSync(path.join(d, 'gm'))),
  );

const read = (dir: string, sub: string, ext: string) =>
  fs.existsSync(path.join(dir, sub))
    ? fs
        .readdirSync(path.join(dir, sub))
        .filter((f) => f.endsWith(ext))
        .map((f) => `${sub}/${f}`)
    : [];

let total = 0;
for (const dir of projects) {
  const models = read(dir, 'gm', '.txt');
  const configurations = read(dir, 'configuration', '.json');
  const domains = read(dir, 'hddl', '.hddl');
  const [world] = read(dir, 'knowledge', '.xml');
  for (const model of models) {
    const stem = path.basename(model, '.txt');
    const configuration =
      configurations.length === 1
        ? configurations[0]
        : configurations.find((c) =>
            stem.endsWith(
              path.basename(c, '.json').replace(/^configuration/, ''),
            ),
          );
    const text = (file: string) =>
      fs.readFileSync(path.join(dir, file), 'utf8');
    const documents: PoolDocument[] = [
      { id: 'model', kind: 'model', value: viewOf(definition, text(model)) },
      ...models
        .filter((other) => other !== model)
        .map((other) => ({
          id: other,
          kind: 'otherModel',
          value: viewOf(definition, text(other)),
        })),
      ...(world ? [{ id: world, kind: 'world', text: text(world) }] : []),
      ...domains.map((d) => ({ id: d, kind: 'hddl', text: text(d) })),
      ...(configuration
        ? [
            {
              id: configuration,
              kind: 'configuration',
              text: text(configuration),
            },
          ]
        : []),
    ];
    const pool = new FactPool(setup);
    pool.update(documents);
    const diagnostics = pool.diagnostics();
    total += diagnostics.length;
    console.log(
      `${path.relative(root, dir)} ${model}: ${diagnostics.length} diagnostics`,
    );
    for (const d of diagnostics)
      console.log(
        `  ${d.severity} ${d.location.document} \`${pool.textOf(d.location.document)?.slice(d.location.from, d.location.to)}\`: ${d.message}`,
      );
  }
}
console.log(`${projects.length} projects, ${total} diagnostics`);
