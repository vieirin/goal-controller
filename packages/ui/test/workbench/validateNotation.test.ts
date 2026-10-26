/**
 * `validate-notation` reports what the Notation editor shows (goal-controller#415
 * review): for a MutRoSe model with its project's world resource, a name the
 * world doesn't have is reported by both, the same diagnostics, because the
 * tool passes the editor's inputs (the tree, the context variables and the
 * project's resources, parsed). The editor here is the page's own language
 * support (`localLanguageSupport`), told about the model as
 * `useLanguageSupport` tells it, linting a CodeMirror view.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import {
  forEachDiagnostic,
  forceLinting,
  type Diagnostic,
} from '@codemirror/lint';
import { goalView } from '@goal-controller/goal-tree';
import {
  notationContextOf,
  notationDocument,
  savedLinesOf,
} from '@goal-controller/goal-language';
import { parseModel } from '@/lib/workbench/dialects';
import { ENGINE_CHECKS, ENGINE_DIALECTS } from '@/lib/workbench/engineDialects';
import { localLanguageSupport } from '@/lib/workbench/languageSupport';
import {
  parseResources,
  resourcesContext,
} from '@/lib/workbench/projectResources';
import {
  workspaceToolsFor,
  type AgentWorkspace,
} from '@/lib/workbench/agent/hostTools';

const DIR = join(__dirname, '../../../../examples/mutrose/medicine-delivery');
const MODEL = readFileSync(join(DIR, 'gm/MedicineDelivery.txt'), 'utf8');
const WORLD = readFileSync(join(DIR, 'knowledge/world_db.xml'), 'utf8');

/** The diagnostics the editor's linter shows for `text`, once it has run. */
const editorDiagnostics = async (
  support: ReturnType<typeof localLanguageSupport>,
  text: string,
): Promise<Diagnostic[]> => {
  const view = new EditorView({
    doc: text,
    extensions: support.documentExtension('model:notation'),
    parent: document.body,
  });
  forceLinting(view);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const found: Diagnostic[] = [];
  forEachDiagnostic(view.state, (diagnostic, from, to) =>
    found.push({ ...diagnostic, from, to }),
  );
  view.destroy();
  return found;
};

describe('validate-notation and the Notation editor (#415 review)', () => {
  it("report the same for a name missing from the project's world", async () => {
    const definition = ENGINE_DIALECTS.mutrose;
    const model = parseModel(MODEL, 'mutrose');
    const tree = goalView(model, definition);
    const slot = {
      kind: 'world',
      definition: definition.projectResources.world,
      paths: ['knowledge/world_db.xml'],
      from: 'manifest' as const,
      absent: [],
      missing: false,
      declared: true,
    };
    const projectResources = resourcesContext(
      parseResources('mutrose', [slot], { 'knowledge/world_db.xml': WORLD }),
    );
    const inputs = { tree, variables: [], projectResources };
    const workspace: AgentWorkspace = {
      ...inputs,
      resources: [
        { kind: 'world', path: 'knowledge/world_db.xml', text: WORLD },
      ],
    };
    // `Locale` is no class of the world (it has Location and Request)
    const text = notationDocument(definition, tree).text.replace(
      'room : Location',
      'room : Locale',
    );

    const support = localLanguageSupport(definition, ENGINE_CHECKS.mutrose);
    support.setSaved(savedLinesOf(definition, tree));
    support.setContext(notationContextOf(definition, inputs));
    const shown = await editorDiagnostics(support, text);

    const tool = workspaceToolsFor('mutrose', () => workspace).find(
      (t) => t.name === 'validate-notation',
    )!;
    // the main thread runs it, with the workspace only (`WorkspaceTool`)
    const result = tool.handler({ text });
    expect(result.ok).toBe(true);

    expect(shown.map((d) => d.message)).toContain(
      'Locale is not a class of the world knowledge (it has Location, Request)',
    );
    expect(JSON.stringify(result.ok && result.content)).toBe(
      JSON.stringify({ diagnostics: shown }),
    );
  });
});
