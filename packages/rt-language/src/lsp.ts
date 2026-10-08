import {
  AstUtils,
  CstUtils,
  DefaultLangiumDocumentFactory,
  GrammarAST,
  inject,
  type AstNode,
  type CstNode,
  type LangiumCoreServices,
  type LangiumDocument,
  type MaybePromise,
  type Module,
  type ParseResult,
  type ParserOptions,
  type URI,
} from 'langium';
import {
  AstNodeHoverProvider,
  createDefaultModule,
  createDefaultSharedModule,
  DefaultCompletionProvider,
  DefaultDefinitionProvider,
  type CompletionAcceptor,
  type CompletionContext,
  type CompletionProviderOptions,
  type DefaultSharedModuleContext,
  type LangiumServices,
  type LangiumSharedServices,
  type NextFeature,
  type PartialLangiumServices,
  type PartialLangiumSharedServices,
} from 'langium/lsp';
import {
  CompletionItemKind,
  LocationLink,
  type CancellationToken,
  type CompletionList,
  type CompletionParams,
  type DefinitionParams,
  type Hover,
  type HoverParams,
} from 'vscode-languageserver';
import {
  CONSTRUCT_HELP,
  CONSTRUCT_LABEL,
  RETRY_HELP,
  RT_OPERATORS,
} from './constructs.js';
import type { RtContext, RtElementKind } from './context.js';
import {
  isAssertAssign,
  isAssertCompare,
  isAssertVar,
  isBinaryExpr,
  isDependsOnId,
  isNodeLine,
  isRetryExpr,
  type Document,
  type NodeLine,
} from './generated/ast.js';
import {
  RtNotationGeneratedModule,
  RtNotationGeneratedSharedModule,
} from './generated/module.js';
import {
  parseValue,
  RtCoreModule,
  type RtAddedServices,
  type RtCoreServices,
} from './module.js';
import {
  isPropertyKey,
  PROPERTY_HELP,
  PROPERTY_MODES,
  type RtPropertyKey,
} from './properties.js';
import { elementBlocks, registerRtValidationChecks } from './validator.js';

export type RtServices = LangiumServices & RtCoreServices;

/** An inspector field's key, from its document's URI (`…/<id>/<key>.rtp`). */
const fieldKey = (uri: URI): RtPropertyKey | undefined => {
  const key = /\/([^/]+)\.rtp$/.exec(uri.path)?.[1];
  return key && isPropertyKey(key) ? key : undefined;
};

/** Parses an inspector field's document with its value's rule, a document otherwise. */
export class RtDocumentFactory extends DefaultLangiumDocumentFactory {
  protected override parse<T extends AstNode>(
    uri: URI,
    text: string,
    options?: ParserOptions,
  ): ParseResult<T> {
    const key = fieldKey(uri);
    return key
      ? parseValue<T>(
          this.serviceRegistry.getServices(uri) as LangiumCoreServices,
          key,
          text,
        )
      : super.parse<T>(uri, text, options);
  }

  protected override parseAsync<T extends AstNode>(
    uri: URI,
    text: string,
    cancellationToken: CancellationToken,
  ): Promise<ParseResult<T>> {
    return fieldKey(uri)
      ? Promise.resolve(this.parse<T>(uri, text))
      : super.parseAsync<T>(uri, text, cancellationToken);
  }
}

/** What an RT operator keyword means, for hover and completion. */
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

/** A resource's declaration in one line: `int 0..100 = 80`. */
const resourceSummary = (
  context: RtContext,
  id: string,
): string | undefined => {
  const resource = context.resource(id);
  if (!resource) return undefined;
  const bounds =
    resource.lowerBound !== undefined && resource.upperBound !== undefined
      ? ` ${resource.lowerBound}..${resource.upperBound}`
      : '';
  const initial = resource.initialValue ? ` = ${resource.initialValue}` : '';
  return `${resource.type || 'untyped'}${bounds}${initial}`;
};

/** The element line a document position belongs to (the nearest one above). */
const elementAbove = (
  document: LangiumDocument,
  offset: number,
): NodeLine | undefined => {
  const lines = (document.parseResult.value as Document).lines ?? [];
  let owner: NodeLine | undefined;
  for (const line of lines.filter(isNodeLine)) {
    if ((line.$cstNode?.offset ?? Infinity) <= offset) owner = line;
  }
  return owner;
};

export class RtCompletionProvider extends DefaultCompletionProvider {
  override readonly completionOptions: CompletionProviderOptions = {
    triggerCharacters: ['[', ';', '+', '#', '|', '?', '>', '&', '!', '(', ','],
  };

  private readonly context: RtContext;

  constructor(services: RtServices) {
    super(services);
    this.context = services.context.Context;
  }

  override async getCompletion(
    document: LangiumDocument,
    params: CompletionParams,
  ): Promise<CompletionList | undefined> {
    const key = fieldKey(document.uri);
    if (!key) return super.getCompletion(document, params);
    // an inspector field holds one value: offer what may be typed at the cursor
    const text = document.textDocument.getText();
    const offset = document.textDocument.offsetAt(params.position);
    const word = /[A-Za-z0-9_.]*$/.exec(text.slice(0, offset))?.[0] ?? '';
    const range = {
      start: document.textDocument.positionAt(offset - word.length),
      end: params.position,
    };
    const items =
      PROPERTY_MODES[key] === 'assertion'
        ? this.assertionNames().map((item) => ({
            ...item,
            textEdit: { range, newText: item.label },
          }))
        : PROPERTY_MODES[key] === 'dependsOn'
          ? this.context.goalIds().map((id) => ({
              label: id,
              kind: CompletionItemKind.Reference,
              textEdit: { range, newText: id },
            }))
          : [];
    return {
      isIncomplete: false,
      items: items.filter((item) => item.label.startsWith(word)),
    };
  }

  /** Resources (with their declaration) and the workbench's variables. */
  private assertionNames() {
    const resources = this.context.resourceIds();
    return [
      ...resources.map((id) => ({
        label: id,
        kind: CompletionItemKind.Variable,
        detail: resourceSummary(this.context, id),
        sortText: '0',
      })),
      // the workbench's variables include the resources the model reads
      ...this.context.variables
        .filter((name) => !resources.includes(name))
        .map((name) => ({
          label: name,
          kind: CompletionItemKind.Variable,
          detail: 'variable',
          sortText: '1',
        })),
    ];
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
    const owner = elementAbove(context.document, context.offset);
    if (GrammarAST.isKeyword(next.feature)) {
      const keyword = next.feature.value;
      if (isPropertyKey(keyword)) {
        const kind = owner && this.context.kindOfLine(owner.name);
        if (kind && kind !== 'resource' && this.reads(kind, keyword)) {
          acceptor(context, {
            label: keyword,
            kind: CompletionItemKind.Property,
            detail: PROPERTY_HELP[keyword],
            sortText: '3',
          });
        }
        return;
      }
      const lineText = context.textDocument.getText({
        start: { line: context.position.line, character: 0 },
        end: context.position,
      });
      const inProperty = isPropertyKey(/^\s*(\w+)/.exec(lineText)?.[1] ?? '');
      if (!inProperty) {
        const help = operatorHelp(keyword);
        if (help) {
          acceptor(context, {
            label: keyword,
            kind: CompletionItemKind.Operator,
            detail: help.label,
            documentation: help.help,
            sortText: '1',
          });
        }
      } else if (
        keyword === 'skip' ||
        keyword === 'true' ||
        keyword === 'false'
      ) {
        acceptor(context, {
          label: keyword,
          kind: CompletionItemKind.Keyword,
          sortText: '2',
        });
      }
      // ids are offered whole, never as their G/T/R/X keywords
      return;
    }
    if (next.property === 'variable') {
      for (const item of this.assertionNames()) acceptor(context, item);
      return;
    }
    if (next.type === 'DependsOnId') {
      for (const id of this.context.goalIds()) {
        if (id !== owner?.name) {
          acceptor(context, { label: id, kind: CompletionItemKind.Reference });
        }
      }
      return;
    }
    if (GrammarAST.isCrossReference(next.feature)) {
      const line = AstUtils.getContainerOfType(context.node, isNodeLine);
      const children = line && this.context.childrenOf(line.name);
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

  /** Whether the engine reads a property on this kind of element (its rules). */
  private reads(kind: RtElementKind, key: string): boolean {
    const rules = this.context.rules?.[kind];
    return !rules || rules.some((rule) => rule.key === key);
  }
}

/** The id a leaf of an assertion or dependsOn names, if it is one. */
const namedId = (leaf: CstNode): string | undefined => {
  const node = leaf.astNode;
  if (
    (isAssertAssign(node) || isAssertCompare(node) || isAssertVar(node)) &&
    leaf.text === node.variable
  ) {
    return node.variable;
  }
  if (isDependsOnId(node)) return node.name;
  return undefined;
};

/** The leaf at an offset, or the one just before it (the cursor after a word). */
const leafAt = (document: LangiumDocument, offset: number) => {
  const root = document.parseResult.value.$cstNode;
  if (!root) return undefined;
  return (
    CstUtils.findLeafNodeAtOffset(root, offset) ??
    CstUtils.findLeafNodeBeforeOffset(root, offset)
  );
};

/** Explains operators and properties, and what an id refers to. */
export class RtHoverProvider extends AstNodeHoverProvider {
  private readonly context: RtContext;

  constructor(services: RtServices) {
    super(services);
    this.context = services.context.Context;
  }

  override async getHoverContent(
    document: LangiumDocument,
    params: HoverParams,
  ): Promise<Hover | undefined> {
    const leaf = leafAt(
      document,
      document.textDocument.offsetAt(params.position),
    );
    if (leaf) {
      const markdown = this.leafHover(leaf);
      if (markdown) {
        return {
          contents: { kind: 'markdown', value: markdown },
          range: leaf.range,
        };
      }
    }
    return super.getHoverContent(document, params);
  }

  private leafHover(leaf: CstNode): string | undefined {
    // RT operators come from a synthetic assignment, `@` is a keyword
    if (isBinaryExpr(leaf.astNode) || isRetryExpr(leaf.astNode)) {
      const help = operatorHelp(leaf.text);
      if (help) return `**${help.label}** \`${leaf.text}\`: ${help.help}`;
    }
    if (GrammarAST.isKeyword(leaf.grammarSource) && isPropertyKey(leaf.text)) {
      return `**${leaf.text}**: ${PROPERTY_HELP[leaf.text]}`;
    }
    const id = namedId(leaf);
    if (id) {
      const resource = resourceSummary(this.context, id);
      if (resource) return `**${id}** resource: \`${resource}\``;
      if (this.context.variables.includes(id))
        return `**${id}**: a workbench variable`;
      const kind = this.context.kindOf(id);
      if (kind && this.context.has(id))
        return `**${id}**: a ${kind} of this model`;
    }
    return undefined;
  }

  protected override getAstNodeHoverContent(node: AstNode): string | undefined {
    return isNodeLine(node)
      ? `**${node.name}** ${node.label.trim()}`
      : undefined;
  }
}

/** An id in an assertion or a dependsOn leads to its element's line. */
export class RtDefinitionProvider extends DefaultDefinitionProvider {
  override async getDefinition(
    document: LangiumDocument,
    params: DefinitionParams,
  ): Promise<LocationLink[] | undefined> {
    const leaf = leafAt(
      document,
      document.textDocument.offsetAt(params.position),
    );
    const id = leaf && namedId(leaf);
    if (leaf && id) {
      const target = elementBlocks(document.parseResult.value as Document).find(
        ({ line }) => line.name === id,
      )?.line;
      const name = target?.$cstNode;
      return name
        ? [
            LocationLink.create(
              document.uri.toString(),
              name.range,
              name.range,
              leaf.range,
            ),
          ]
        : undefined;
    }
    return super.getDefinition(document, params);
  }
}

export const RtLspModule: Module<RtServices, PartialLangiumServices> = {
  lsp: {
    CompletionProvider: (services) => new RtCompletionProvider(services),
    HoverProvider: (services) => new RtHoverProvider(services),
    DefinitionProvider: (services) => new RtDefinitionProvider(services),
  },
};

export const RtSharedModule: Module<
  LangiumSharedServices,
  PartialLangiumSharedServices
> = {
  workspace: {
    LangiumDocumentFactory: (services) => new RtDocumentFactory(services),
  },
};

export const createRtServices = (
  context: DefaultSharedModuleContext,
): { shared: LangiumSharedServices; RtNotation: RtServices } => {
  const shared = inject(
    createDefaultSharedModule(context),
    RtNotationGeneratedSharedModule,
    RtSharedModule,
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
