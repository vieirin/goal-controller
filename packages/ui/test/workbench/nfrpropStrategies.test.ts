/**
 * nfrprop's strategies, a project resource (goal-controller#328, GRL's
 * pattern): several cases for the same analysis run, which the case picker
 * (`TopBar`'s `CasePicker`, `packages/ui/lib/workbench/analysis.ts`'s
 * `pickableCases`/`caseText`) lists.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENGINE_ANALYSES } from '@/lib/workbench/engineDialects';
import { analyse, caseText, pickableCases } from '@/lib/workbench/analysis';

const ROOT = join(__dirname, '../../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const NFR_WELCOME = read('examples/nfr/nfr-welcome.txt');
const RSA_260_ONLY = read('examples/nfr/strategies/rsa-260-only.json');
const BOTH = read('examples/nfr/strategies/both.json');

describe("nfrprop's strategies, in the workbench's case picker (#328)", () => {
  it('lists "Model labels", then one case per strategy, in file order', () => {
    const engine = ENGINE_ANALYSES.nfrprop!;
    const resource = {
      'strategies/rsa-260-only.json': RSA_260_ONLY,
      'strategies/both.json': BOTH,
    };
    const run = analyse(
      'nfrLabels',
      engine.analyses.nfrLabels!,
      NFR_WELCOME,
      engine.model,
      resource,
    );
    expect('result' in run).toBe(true);
    const cases = 'result' in run ? run.result.cases : [];
    expect(cases.map((c) => c.label)).toEqual([
      'Model labels',
      'RSA 260 only',
      'both',
    ]);
    const { cases: picked, matching } = pickableCases(cases, '');
    expect(matching).toBe(3);
    expect(picked.map(caseText)).toEqual([
      'Model labels',
      'RSA 260 only',
      'both',
    ]);
    const { cases: searched } = pickableCases(cases, 'rsa');
    expect(searched.map(caseText)).toEqual(['RSA 260 only']);
  });
});
