/** The Edge engines' project resources, parsed: variables and property suites. */
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  edge,
  edgeProjectResources,
  edgeV2,
  parseProperties,
  parseVariables,
} from '../../../src';

describe('Edge variables', () => {
  it('reads a value for each variable', () => {
    const text = '{ "isRaining": false, "T1_achievable": 0.9 }';
    const { data, symbols, diagnostics } = parseVariables([
      { path: 'variables.json', text },
    ]);
    expect(diagnostics).to.deep.equal([]);
    expect(data).to.deep.equal({ isRaining: false, T1_achievable: 0.9 });
    expect(symbols.variables).to.deep.equal([
      { name: 'isRaining', detail: 'false' },
      { name: 'T1_achievable', detail: '0.9' },
    ]);
  });

  it('says which value is not one, at its key', () => {
    const text = '{ "ok": true, "bad": "yes" }';
    const { data, diagnostics } = parseVariables([
      { path: 'variables.json', text },
    ]);
    expect(data).to.deep.equal({ ok: true });
    expect(
      diagnostics.map((d) => [d.message, text.slice(d.from, d.to)]),
    ).to.deep.equal([['bad: a variable is true, false or a number', '"bad"']]);
    expect(
      parseVariables([{ path: 'v.json', text: '[1]' }]).diagnostics[0]!.message,
    ).to.match(/JSON object/);
  });
});

describe('Edge property suites', () => {
  it('reads one property per statement, with its label, across files', () => {
    const text = [
      '// reachability',
      '"done": P=? [ F G0_achieved ]',
      'P>=0.9 [ F (G1_achieved',
      '  & G2_achieved) ] // continues over lines',
      '',
    ].join('\n');
    const { data, symbols, diagnostics } = parseProperties([
      { path: 'props/a.pctl', text },
      { path: 'props/b.props', text: 'R=? [ F done ]\n' },
    ]);
    expect(diagnostics).to.deep.equal([]);
    expect(
      data.map((suite) => suite.properties.map((p) => p.name ?? p.text)),
    ).to.deep.equal([
      ['done', 'P>=0.9 [ F (G1_achieved\n  & G2_achieved) ]'],
      ['R=? [ F done ]'],
    ]);
    const [first] = data[0]!.properties;
    expect(text.slice(first!.from, first!.to)).to.equal(
      '"done": P=? [ F G0_achieved ]',
    );
    expect(symbols.properties!.map((p) => p.name)).to.deep.equal([
      'done',
      'a.pctl#2',
      'b.props#1',
    ]);
  });

  it('says which bracket does not close', () => {
    const text = 'P=? [ F (a ]\nP=? [ F b';
    const { diagnostics } = parseProperties([{ path: 'p.pctl', text }]);
    expect(
      diagnostics.map((d) => [d.message, text.slice(d.from, d.to)]),
    ).to.deep.equal([
      ['] closes (', ']'],
      ['[ is not closed', '['],
      ['[ is not closed', '['],
    ]);
  });

  it("reads the examples' suites without a problem", () => {
    for (const engine of ['edge', 'edgeV2']) {
      const path = join(
        __dirname,
        `../../../../../examples/${engine}/props/goalModel_TAS_3.props`,
      );
      const { data, diagnostics } = parseProperties([
        { path, text: readFileSync(path, 'utf8') },
      ]);
      expect(diagnostics, engine).to.deep.equal([]);
      expect(data[0]!.properties.length, engine).to.be.greaterThan(5);
    }
  });
});

describe('Edge parser registry', () => {
  it('parses the kinds both Edge definitions declare', () => {
    expect(Object.keys(edgeProjectResources).sort()).to.deep.equal([
      'properties',
      'variables',
    ]);
    expect(Object.keys(edge.projectResources).sort()).to.deep.equal([
      'properties',
      'variables',
    ]);
    expect(edgeV2.projectResources).to.deep.equal(edge.projectResources);
  });
});
