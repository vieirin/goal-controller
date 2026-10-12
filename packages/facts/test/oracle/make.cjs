#!/usr/bin/env node
/**
 * The oracle shared with #59's design: a broken copy of medicine-delivery per
 * cross-file check, each changing one thing. `node test/oracle/make.cjs`
 * writes them again from the example (expected.json is written by hand).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const SOURCE = path.join(ROOT, 'examples', 'projects', 'medicine-delivery');

const CASES = {
  clean: [],
  'unknown-hddl-task': [
    ['gm/MedicineDelivery.txt', '"AT1: NavigateTo"', '"AT1: Fly"'],
  ],
  'unbound-param': [
    [
      'configuration/configuration.json',
      '    { "task_id": "AT2", "map": [{ "gm_var": "current_request", "hddl_var": "?r" }] },\n',
      '',
    ],
  ],
  'hddl-var-not-param': [
    [
      'configuration/configuration.json',
      '"hddl_var": "?l"',
      '"hddl_var": "?x"',
    ],
  ],
  'unknown-mapping-task': [
    [
      'configuration/configuration.json',
      '"task_id": "AT3"',
      '"task_id": "AT9"',
    ],
  ],
  'unknown-mapping-class': [
    [
      'configuration/configuration.json',
      '"ocl_type": "Request"',
      '"ocl_type": "Order"',
    ],
  ],
  'unknown-mapping-variable': [
    [
      'configuration/configuration.json',
      '"gm_var": "room"',
      '"gm_var": "rooom"',
    ],
  ],
  'unknown-mapping-type': [
    [
      'configuration/configuration.json',
      '"hddl_type": "location"',
      '"hddl_type": "place"',
    ],
  ],
  'unused-hddl-task': [
    [
      'hddl/domain.hddl',
      '  (:task notifynurse :parameters (?r - request))\n',
      '  (:task notifynurse :parameters (?r - request))\n  (:task cleanup :parameters (?l - location))\n',
    ],
  ],
  'no-instances': [
    ['knowledge/world_db.xml', '        <name>req1</name>\n', ''],
    ['knowledge/world_db.xml', '        <name>req2</name>\n', ''],
  ],
};

for (const [name, edits] of Object.entries(CASES)) {
  const dir = path.join(__dirname, name);
  for (const entry of fs.readdirSync(SOURCE, { recursive: true })) {
    const from = path.join(SOURCE, entry);
    if (fs.statSync(from).isDirectory()) continue;
    fs.mkdirSync(path.dirname(path.join(dir, entry)), { recursive: true });
    fs.copyFileSync(from, path.join(dir, entry));
  }
  for (const [file, before, after] of edits) {
    const at = path.join(dir, file);
    const text = fs.readFileSync(at, 'utf8');
    if (!text.includes(before))
      throw new Error(`${name}: ${file} has no ${before}`);
    fs.writeFileSync(at, text.replace(before, after));
  }
}
