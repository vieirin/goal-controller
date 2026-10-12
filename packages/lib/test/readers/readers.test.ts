/**
 * Typed readers (goal-controller#79): a file kind plugs in with its parser,
 * its schema and its facts; Zod's issues land where they are written; what
 * the schema rejects is left out, the rest read where it is written.
 */
import { expect } from 'chai';
import * as z from 'zod/mini';
import type { Node } from 'jsonc-parser';
import { read, type Parsed, type Reader } from '../../src/readers';
import { configurationReader } from '../../src/engines/mutrose/readers/configuration';
import { readWorld } from '../../src/engines/mutrose/readers/world';

const shown = (
  text: string,
  problems: { message: string; from: number; to: number }[],
) => problems.map((p) => [p.message, text.slice(p.from, p.to)]);

describe('typed readers', () => {
  it('plugs in a file kind of its own: a parser, a schema, its facts', () => {
    // `KEY=value` lines: a toy format the core knows nothing of
    const parseEnv = (text: string): Parsed => {
      const tree: Node = {
        type: 'object',
        offset: 0,
        length: text.length,
        children: [],
      };
      let offset = 0;
      for (const line of text.split('\n')) {
        const eq = line.indexOf('=');
        if (eq > 0) {
          const property: Node = {
            type: 'property',
            offset,
            length: line.length,
            parent: tree,
            children: [],
          };
          property.children!.push(
            {
              type: 'string',
              value: line.slice(0, eq),
              offset,
              length: eq,
              parent: property,
            },
            {
              type: 'string',
              value: line.slice(eq + 1),
              offset: offset + eq + 1,
              length: line.length - eq - 1,
              parent: property,
            },
          );
          tree.children!.push(property);
        }
        offset += line.length + 1;
      }
      return { tree, problems: [] };
    };
    const env: Reader<Record<string, string>, string[]> = {
      parse: parseEnv,
      schema: z.record(
        z.string(),
        z.string().check(z.regex(/^\d+$/, 'A port is a number')),
      ),
      facts: (value, at) =>
        Object.keys(value).map((key) => `${key}@${at([key], 'key')!.from}`),
    };
    const text = 'HTTP=80\nADMIN=x\nHTTPS=443';
    const reading = read(env, 'ports.env', text);
    expect(reading.value).to.deep.equal({ HTTP: '80', HTTPS: '443' });
    expect(reading.facts).to.deep.equal(['HTTP@0', 'HTTPS@16']);
    expect(shown(text, reading.problems)).to.deep.equal([
      ['A port is a number', 'x'],
    ]);
  });

  it('leaves out what the schema rejects, and reads the rest where it is written', () => {
    const text = JSON.stringify({
      location_types: ['Room', 4, 'Dock'],
      type_mapping: [
        { hddl_type: 'room' },
        { hddl_type: 'dock', ocl_type: 'Dock' },
      ],
    });
    const { value, facts, problems } = read(
      configurationReader,
      'c.json',
      text,
    );
    expect(value).to.deep.equal({
      location_types: ['Room', 'Dock'],
      type_mapping: [{ hddl_type: 'dock', ocl_type: 'Dock' }],
    });
    // after the left-out item and entry, each name still where it is written
    expect(
      facts!.references.map((r) => [
        r.name,
        text.slice(r.location.from, r.location.to),
      ]),
    ).to.deep.equal([
      ['Room', 'Room'],
      ['Dock', 'Dock'],
      ['dock', 'dock'],
      ['Dock', 'Dock'],
    ]);
    expect(shown(text, problems)).to.deep.equal([
      ['This should be a string, not a number', '4'],
      ['Missing `ocl_type`', '{'],
    ]);
  });

  it('says a missing key at the key of the object missing it', () => {
    const text =
      '{ "var_mapping": [{ "task_id": "AT1", "map": [] }], "world_db": 3 }';
    expect(
      shown(text, read(configurationReader, 'c.json', text).problems),
    ).to.deep.equal([['`world_db` should be an object, not a number', '3']]);
    const missing = '{ "var_mapping": [{ "map": [] }] }';
    expect(
      shown(missing, read(configurationReader, 'c.json', missing).problems),
    ).to.deep.equal([['Missing `task_id`', '{']]);
  });

  it('reads the last of a key written twice, and says so at the first', () => {
    const text = '{ "location_types": ["A"], "location_types": ["B"] }';
    const { value, problems } = read(configurationReader, 'c.json', text);
    expect(value).to.deep.equal({ location_types: ['B'] });
    expect(shown(text, problems)).to.deep.equal([
      [
        "`location_types` is written again below: this one isn't read",
        'location_types',
      ],
    ]);
  });

  it('keeps reading a JSON file being typed', () => {
    const text = '{ "location_types": ["Room", "Do';
    const { value, problems } = read(configurationReader, 'typing.json', text);
    expect(value).to.deep.equal({ location_types: ['Room', 'Do'] });
    expect(problems.map((p) => p.message)).to.include.members([
      'Not valid JSON: Unexpected end of string',
    ]);
  });

  it('keeps an XML file’s last good facts while it does not parse; an empty one has none', () => {
    const good = '<world_db><Room><name>A</name></Room></world_db>';
    const names = (text: string) =>
      readWorld('stale.xml', text).definitions.map((d) => d.name);
    expect(names(good)).to.deep.equal(['world_db', 'Room', 'name', 'A']);
    expect(
      names('<world_db><Room><name>A</nme></Room></world_db>'),
    ).to.deep.equal(['world_db', 'Room', 'name', 'A']);
    expect(names('')).to.deep.equal([]);
  });

  it('reads a text once: the same text, the same reading', () => {
    const text = '{ "location_types": ["Room"] }';
    const first = read(configurationReader, 'once.json', text);
    expect(read(configurationReader, 'once.json', text)).to.equal(first);
    expect(read(configurationReader, 'once.json', `${text} `)).to.not.equal(
      first,
    );
  });
});
