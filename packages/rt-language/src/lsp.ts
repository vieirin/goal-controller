import {
  AstUtils,
  CstUtils,
  GrammarAST,
  inject,
  type AstNode,
  type LangiumDocument,
  type MaybePromise,
  type Module,
} from 'langium';
import {
  AstNodeHoverProvider,
  createDefaultModule,
  createDefaultSharedModule,
  DefaultCompletionProvider,
  type CompletionAcceptor,
  type CompletionContext,
  type CompletionProviderOptions,
  type DefaultSharedModuleContext,
  type LangiumServices,
  type LangiumSharedServices,
  type NextFeature,
  type PartialLangiumServices,
} from 'langium/lsp';
import {
  CompletionItemKind,
  type Hover,
  type HoverParams,
} from 'vscode-languageserver';
import {
  CONSTRUCT_HELP,
  CONSTRUCT_LABEL,
  RETRY_HELP,
  RT_OPERATORS,
} from './constructs.js';
import { isBinaryExpr, isNodeLine, type Document } from './generated/ast.js';
import {
  RtNotationGeneratedModule,
  RtNotationGeneratedSharedModule,
} from './generated/module.js';
import {
  RtCoreModule,
  type RtAddedServices,
  type RtCoreServices,
} from './module.js';
import type { RtStructure } from './structure.js';
import { registerRtValidationChecks } from './validator.js';

export type RtServices = LangiumServices & RtCoreServices;

/** What an operator keyword means, for hover and completion. */
const operatorHelp = (
  keyword: string,
): { label: string; help: string } | undefined => {
  if (keyword === '@') return { label: 'Retry', help: RETRY_HELP };
  const operator = RT_OPERATORS.find(({ op }) => op === keyword);
  return (
    operator && {
      label: CONSTRUCT_LABEL[operator.construct],
      help: CONSTRUCT_HELP[operator.construct],
    }
  );
};

/** Offers the goal's children where an id goes, and the notation operators. */
export class RtCompletionProvider extends DefaultCompletionProvider {
  override readonly completionOptions: CompletionProviderOptions = {
    triggerCharacters: ['[', ';', '+', '#', '|', '?', '>'],
  };

  private readonly structure: RtStructure;

  constructor(services: RtServices) {
    super(services);
    this.structure = services.structure.Structure;
  }

  // after an id (`[G1|`) both the id and the operators that may follow apply
  protected override continueCompletion(): boolean {
    return true;
  }

  protected override completionFor(
    context: CompletionContext,
    next: NextFeature,
    acceptor: CompletionAcceptor,
  ): MaybePromise<void> {
    if (GrammarAST.isKeyword(next.feature)) {
      const keyword = next.feature.value;
      const help = operatorHelp(keyword);
      if (help) {
        acceptor(context, {
          label: keyword,
          kind: CompletionItemKind.Operator,
          detail: help.label,
          documentation: help.help,
          sortText: '1',
        });
      } else if (keyword === 'skip') {
        acceptor(context, {
          label: keyword,
          kind: CompletionItemKind.Keyword,
          sortText: '2',
        });
      }
      // ids are offered whole, never as their G/T/R/X keywords
      return;
    }
    if (GrammarAST.isCrossReference(next.feature)) {
      const line = AstUtils.getContainerOfType(context.node, isNodeLine);
      const children = line && this.structure.childrenOf(line.name);
      if (children) {
        const lines = (context.document.parseResult.value as Document).lines;
        for (const child of children) {
          acceptor(context, {
            label: child,
            kind: CompletionItemKind.Reference,
            detail: lines
              .filter(isNodeLine)
              .find((l) => l.name === child)
              ?.label.trim(),
            sortText: '0',
          });
        }
        return;
      }
    }
    return super.completionFor(context, next, acceptor);
  }
}

/** Explains operators, and shows the element an id refers to. */
export class RtHoverProvider extends AstNodeHoverProvider {
  override async getHoverContent(
    document: LangiumDocument,
    params: HoverParams,
  ): Promise<Hover | undefined> {
    const root = document.parseResult.value.$cstNode;
    if (root) {
      const offset = document.textDocument.offsetAt(params.position);
      const leaf = CstUtils.findLeafNodeAtOffset(root, offset);
      // infix operators come from a synthetic assignment, `@` is a keyword
      if (
        leaf &&
        (GrammarAST.isKeyword(leaf.grammarSource) || isBinaryExpr(leaf.astNode))
      ) {
        const help = operatorHelp(leaf.text);
        if (help) {
          return {
            contents: {
              kind: 'markdown',
              value: `**${help.label}** \`${leaf.text}\`: ${help.help}`,
            },
            range: leaf.range,
          };
        }
      }
    }
    return super.getHoverContent(document, params);
  }

  protected override getAstNodeHoverContent(node: AstNode): string | undefined {
    return isNodeLine(node)
      ? `**${node.name}** ${node.label.trim()}`
      : undefined;
  }
}

export const RtLspModule: Module<RtServices, PartialLangiumServices> = {
  lsp: {
    CompletionProvider: (services) => new RtCompletionProvider(services),
    HoverProvider: (services) => new RtHoverProvider(services),
  },
};

export const createRtServices = (
  context: DefaultSharedModuleContext,
): { shared: LangiumSharedServices; RtNotation: RtServices } => {
  const shared = inject(
    createDefaultSharedModule(context),
    RtNotationGeneratedSharedModule,
  );
  const RtNotation = inject(
    createDefaultModule({ shared }),
    RtNotationGeneratedModule,
    RtCoreModule as Module<
      RtServices,
      PartialLangiumServices & RtAddedServices
    >,
    RtLspModule,
  );
  shared.ServiceRegistry.register(RtNotation);
  registerRtValidationChecks(RtNotation);
  return { shared, RtNotation };
};
