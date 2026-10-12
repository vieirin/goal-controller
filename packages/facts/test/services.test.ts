/** Definition, references and rename across medicine-delivery's four files, as queries. */
import * as assert from 'assert';
import { describe, it } from 'mocha';
import type { PoolLocation } from '../src';
import { exampleProject, poolOf, withProperties } from './project';

const CONFIGURATION = 'configuration/configuration.json';
const WORLD = 'knowledge/world_db.xml';
const HDDL = 'hddl/domain.hddl';

describe('services across medicine-delivery’s files', () => {
  const files = exampleProject('medicine-delivery');
  const { pool } = poolOf(files);
  /** the text at a location, in its document */
  const textAt = (at: PoolLocation) =>
    pool.textOf(at.document)!.slice(at.from, at.to);
  /** the offset of the n-th `needle` in a document */
  const offset = (document: string, needle: string, nth = 0) => {
    const text = pool.textOf(document)!;
    let at = -1;
    for (let i = 0; i <= nth; i += 1) at = text.indexOf(needle, at + 1);
    assert.ok(at >= 0, `${needle} not in ${document}`);
    return at + 1;
  };
  /** where `?l` is a parameter of the HDDL task navigateto */
  const navigatetoL = () => {
    const text = pool.textOf(HDDL)!;
    return text.indexOf('?l', text.indexOf('(:task navigateto'));
  };
  const where = (locations: PoolLocation[]) =>
    locations.map((at) => `${at.document} ${textAt(at)}`).sort();

  it('goes to definition across files', () => {
    // configuration → model: a var_mapping's task
    assert.deepStrictEqual(
      where(pool.definitionAt(CONFIGURATION, offset(CONFIGURATION, 'AT1'))),
      ['model:AT1:id AT1'],
    );
    // model → HDDL: a task's name
    assert.deepStrictEqual(where(pool.definitionAt('model:AT1:name', 2)), [
      `${HDDL} navigateto`,
    ]);
    // configuration → HDDL: an hddl_var, the parameter of the task AT1 stands for
    const param = pool.definitionAt(CONFIGURATION, offset(CONFIGURATION, '?l'));
    assert.deepStrictEqual(where(param), [`${HDDL} ?l`]);
    assert.strictEqual(param[0]!.from, navigatetoL());
    // model → world: a Controls type, and a path's attribute through its variable's type
    assert.deepStrictEqual(
      where(
        pool.definitionAt(
          'model:G3:Controls',
          offset('model:G3:Controls', 'Request'),
        ),
      ),
      [`${WORLD} Request`],
    );
    const room = offset('model:G4:QueriedProperty', 'room');
    assert.deepStrictEqual(
      where(pool.definitionAt('model:G4:QueriedProperty', room)),
      [`${WORLD} room`],
    );
    // a select's own variable stays local
    assert.deepStrictEqual(
      where(
        pool.definitionAt(
          'model:G2:QueriedProperty',
          offset('model:G2:QueriedProperty', 'r.pending'),
        ),
      ),
      ['model:G2:QueriedProperty r'],
    );
  });

  it('finds references across files', () => {
    assert.deepStrictEqual(
      where(pool.referencesAt(WORLD, offset(WORLD, 'Request'))),
      [
        `${CONFIGURATION} Request`,
        `${WORLD} Request`,
        `${WORLD} Request`,
        `${WORLD} Request`,
        `${WORLD} Request`,
        'model:G2:Controls Request',
        'model:G2:QueriedProperty Request',
        'model:G3:Controls Request',
      ],
    );
  });

  it('renames a world class in the world, the configuration and the model', () => {
    const result = pool.renameAt(WORLD, offset(WORLD, 'Request'), 'Order');
    assert.ok('edits' in result);
    assert.deepStrictEqual(
      result.edits
        .map(
          (e) =>
            `${e.document} ${pool.textOf(e.document)!.slice(e.from, e.to)}→${e.text}`,
        )
        .sort(),
      [
        `${CONFIGURATION} Request→Order`,
        `${WORLD} Request→Order`,
        `${WORLD} Request→Order`,
        `${WORLD} Request→Order`,
        `${WORLD} Request→Order`,
        'model:G2:Controls Request→Order',
        'model:G2:QueriedProperty Request→Order',
        'model:G3:Controls Request→Order',
      ],
    );
  });

  it('renames an HDDL parameter in its task and the configuration, not in another method’s', () => {
    const at = navigatetoL();
    const result = pool.renameAt(HDDL, at + 1, 'place');
    assert.ok('edits' in result, JSON.stringify(result));
    assert.deepStrictEqual(
      result.edits.map((e) => `${e.document}:${e.from} ${e.text}`),
      [
        `${HDDL}:${at} ?place`,
        `${CONFIGURATION}:${offset(CONFIGURATION, '?l') - 1} ?place`,
      ],
    );
  });

  it('renames a model task: its id, its parent’s notation and the configuration', () => {
    const result = pool.renameAt('model:AT1:id', 1, 'AT7');
    assert.ok('edits' in result);
    assert.deepStrictEqual(result.edits.map((e) => e.document).sort(), [
      CONFIGURATION,
      'model:AT1:id',
      'model:G5:notation',
    ]);
  });

  it('refuses a rename to a name its kind already has in its scope (a rule)', () => {
    assert.deepStrictEqual(
      pool.renameAt(WORLD, offset(WORLD, 'Request'), 'Location'),
      {
        refused: 'A world class named `Location` is already defined here',
      },
    );
    // an attribute is scoped by its class: Request's `room` may not become `name`…
    assert.ok(
      'refused' in pool.renameAt(WORLD, offset(WORLD, '<room>') + 1, 'name'),
    );
    // …but `pending` may become `urgent`
    assert.ok(
      'edits' in pool.renameAt(WORLD, offset(WORLD, '<pending>') + 1, 'urgent'),
    );
  });

  it('re-extracts only the model field edited, and cuts off a move', () => {
    const { pool: fresh, documents } = poolOf(files);
    const before = { ...fresh.stats };
    fresh.update(
      withProperties(documents, { AT1: { Params: 'room, current_request' } }),
    );
    assert.strictEqual(fresh.stats.extracted - before.extracted, 1);
    assert.deepStrictEqual(
      fresh.diagnostics().map((d) => `${d.location.document} ${d.code}`),
      ['model:AT1:Params mutrose.unboundParam'],
    );
    fresh.update(withProperties(documents, { AT1: { Params: '  room' } }));
    assert.strictEqual(fresh.stats.cutOffs - before.cutOffs, 0);
    fresh.update(withProperties(documents, { AT1: { Params: ' room' } }));
    assert.strictEqual(fresh.stats.cutOffs - before.cutOffs, 1);
  });

  it('hovers with the definition’s kind and type', () => {
    const hover = pool.hoverAt('model:G3:AchieveCondition', 1);
    assert.deepStrictEqual(
      hover && { label: hover.label, name: hover.name, type: hover.type },
      { label: 'variable', name: 'requests', type: 'Sequence(Request)' },
    );
    const room = pool.hoverAt(WORLD, offset(WORLD, '<room>') + 1);
    assert.strictEqual(room?.type, 'Location');
  });
});
