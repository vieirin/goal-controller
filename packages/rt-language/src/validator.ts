import {
  AstUtils,
  type AstNode,
  type ValidationAcceptor,
  type ValidationChecks,
} from 'langium';
import { relationMismatch } from './constructs.js';
import {
  MISSING_FROM_NOTATION,
  NOT_A_CHILD,
  NOT_IN_DIAGRAM,
  type RtContext,
  type RtElementKind,
  type RtProperties,
} from './context.js';
import {
  isAssertAssign,
  isAssertCompare,
  isAssertVar,
  isNodeLine,
  isRef,
  type AssertionValue,
  type DependsOnValue,
  type Document,
  type NodeLine,
  type PropertyLine,
  type RawValue,
  type RtNotationAstType,
} from './generated/ast.js';
import { isPropertyKey, type RtPropertyKey } from './properties.js';

/** An inspector field's document: `…/<element id>/<property key>.rtp`. */
export const fieldOf = (
  node: AstNode,
): { id: string; key: RtPropertyKey } | undefined => {
  const path = AstUtils.getDocument(node).uri.path;
  const match = /\/([^/]+)\/([^/]+)\.rtp$/.exec(path);
  return match && isPropertyKey(match[2]!)
    ? { id: decodeURIComponent(match[1]!), key: match[2] }
    : undefined;
};

/** The text of a property value as stored (what the engine's checks read). */
export const valueText = (node: AstNode | undefined): string =>
  node?.$cstNode?.text.trim() ?? '';

/** Each element line with the property lines under it. */
export const elementBlocks = (
  document: Document,
): Array<{ line: NodeLine; properties: PropertyLine[] }> => {
  const blocks: Array<{ line: NodeLine; properties: PropertyLine[] }> = [];
  for (const line of document.lines) {
    if (isNodeLine(line)) blocks.push({ line, properties: [] });
    else blocks.at(-1)?.properties.push(line);
  }
  return blocks;
};

/**
 * One validator for the notation document and the inspector's fields. The
 * property rules are the engine's own (the editor injects them); the checks
 * here are the ones that need several elements: types and bounds of the
 * resources an assertion compares, and dependsOn cycles.
 */
export class RtValidator {
  constructor(private readonly context: RtContext) {}

  checkDocument(document: Document, accept: ValidationAcceptor): void {
    const seen = new Set<string>();
    let previous: NodeLine | undefined;
    for (const line of document.lines.filter(isNodeLine)) {
      if (seen.has(line.name)) {
        accept('error', `Duplicate id ${line.name}`, {
          node: line,
          property: 'name',
        });
      }
      seen.add(line.name);
      const start = line.$cstNode?.range.start.line;
      if (
        previous &&
        start !== undefined &&
        start === previous.$cstNode?.range.end.line
      ) {
        accept('error', 'Put each element on its own line', { node: line });
      }
      previous = line;
    }
    const first = document.lines[0];
    if (first && !isNodeLine(first)) {
      accept('error', 'A property belongs under an element line', {
        node: first,
      });
    }
    for (const { line, properties } of elementBlocks(document)) {
      this.checkProperties(line, properties, accept);
    }
  }

  checkNodeLine(line: NodeLine, accept: ValidationAcceptor): void {
    if (!this.context.known) return;
    if (!this.context.has(line.name)) {
      accept('error', NOT_IN_DIAGRAM, { node: line, property: 'name' });
      return;
    }
    if (!line.notation) return;
    const element = this.context.element(line.name);
    const mismatch = relationMismatch(element?.construct, element?.relation);
    if (mismatch) {
      accept('error', mismatch, { node: line, property: 'notation' });
    }
    const children = this.context.childrenOf(line.name) ?? [];
    const refs = AstUtils.streamAst(line.notation).filter(isRef).toArray();
    const listed = new Set(refs.map((ref) => ref.ref.$refText));
    for (const ref of refs) {
      if (!children.includes(ref.ref.$refText)) {
        accept('error', NOT_A_CHILD, { node: ref });
      }
    }
    for (const child of children) {
      if (!listed.has(child)) {
        accept('warning', `${MISSING_FROM_NOTATION}: ${child}`, {
          node: line,
          property: 'notation',
        });
      }
    }
  }

  /** The engine's rules for an element's properties, as the document has them. */
  private checkProperties(
    line: NodeLine,
    lines: PropertyLine[],
    accept: ValidationAcceptor,
  ): void {
    const kind = this.context.kindOfLine(line.name);
    const properties: RtProperties = line.resource
      ? {
          type: line.resource.type,
          lowerBound: line.resource.lowerBound,
          upperBound: line.resource.upperBound,
          initialValue: line.resource.initialValue,
        }
      : Object.fromEntries(
          lines.map((property) => [property.key, valueText(property.value)]),
        );
    const keyed = new Map<string, PropertyLine>(
      lines.map((property) => [property.key, property]),
    );
    for (const property of lines) {
      if (kind === 'resource') {
        accept('warning', 'A resource declares its values in `{…}`', {
          node: property,
          property: 'key',
        });
      }
    }
    this.checkRules(line.name, kind, properties, accept, (key) => {
      const property = keyed.get(key);
      return property
        ? { node: property, property: 'value' }
        : line.resource
          ? { node: line.resource }
          : { node: line, property: 'name' };
    });
    for (const property of lines) {
      if (
        kind &&
        kind !== 'resource' &&
        this.context.rules &&
        !this.context.rules[kind].some((rule) => rule.key === property.key)
      ) {
        accept('warning', `Not read for a ${kind}`, {
          node: property,
          property: 'key',
        });
      }
    }
  }

  /** Runs each rule of the element's kind; `at` places a key's diagnostic. */
  private checkRules(
    id: string,
    kind: RtElementKind | undefined,
    properties: RtProperties,
    accept: ValidationAcceptor,
    at: (key: string) => { node: AstNode; property?: string },
    only?: string,
  ): void {
    const rules = kind && this.context.rules?.[kind];
    if (!rules) return;
    const kindOf = (other: string) => this.context.kindOf(other);
    for (const rule of rules) {
      if (only && rule.key !== only) continue;
      const set = properties[rule.key] !== undefined;
      if (set && rule.applies && !rule.applies(properties)) {
        accept(
          'warning',
          rule.notApplying?.(properties) ?? 'Not read with these properties',
          at(rule.key) as never,
        );
        continue;
      }
      const message = rule.validate?.(properties, { self: id, kindOf });
      if (message) accept('error', message, at(rule.key) as never);
    }
  }

  /** An inspector field: the engine's rule for its key, with the element's other properties. */
  private checkField(
    value: AssertionValue | DependsOnValue | RawValue,
    accept: ValidationAcceptor,
  ): void {
    const field = fieldOf(value);
    if (!field) return;
    const properties = {
      ...this.context.propertiesOf(field.id),
      [field.key]: valueText(value),
    };
    this.checkRules(
      field.id,
      this.context.kindOfLine(field.id),
      properties,
      accept,
      () => ({ node: value }),
      field.key,
    );
  }

  checkAssertion(value: AssertionValue, accept: ValidationAcceptor): void {
    if (value.$container === undefined) this.checkField(value, accept);
    if (!value.expr) return;
    for (const node of AstUtils.streamAst(value.expr)) {
      if (!isAssertAssign(node) && !isAssertCompare(node) && !isAssertVar(node))
        continue;
      const name = node.variable;
      const resource = this.context.resource(name);
      if (!resource) {
        if (this.context.known && !this.context.variables.includes(name)) {
          accept(
            'hint',
            `${name} is not a resource of this model or a known variable`,
            { node, property: 'variable' },
          );
        }
        continue;
      }
      if (isAssertAssign(node) && resource.type === 'int') {
        accept(
          'error',
          `${name} is an int resource: compare it with a number`,
          { node },
        );
      }
      if (isAssertCompare(node)) {
        if (resource.type === 'bool') {
          accept(
            'error',
            `${name} is a bool resource: use ${name} = true or false`,
            { node },
          );
          continue;
        }
        const n = parseInt(node.value, 10);
        const { lowerBound: lo, upperBound: hi } = resource;
        if (lo !== undefined && hi !== undefined && (n < lo || n > hi)) {
          accept('warning', `${n} is outside ${name}'s bounds [${lo}..${hi}]`, {
            node,
            property: 'value',
          });
        }
      }
    }
  }

  checkDependsOn(value: DependsOnValue, accept: ValidationAcceptor): void {
    const field = fieldOf(value);
    const self = field?.id ?? this.ownerOf(value);
    if (field) this.checkField(value, accept);
    if (!self) return;
    const ids = value.ids.map((dependency) => dependency.name);
    for (const dependency of value.ids) {
      if (dependency.name === self) {
        accept('warning', `${self} depends on itself`, { node: dependency });
        continue;
      }
      const cycle = this.cycleFrom(dependency.name, self, ids);
      if (cycle) {
        accept(
          'warning',
          `Circular dependency: ${[self, ...cycle].join(' → ')}`,
          { node: dependency },
        );
      }
    }
  }

  checkRawValue(value: RawValue, accept: ValidationAcceptor): void {
    if (value.$container === undefined) this.checkField(value, accept);
  }

  /** The element a property line in the document belongs to. */
  private ownerOf(value: AstNode): string | undefined {
    const document = AstUtils.getContainerOfType(
      value,
      (node): node is Document => node.$type === 'Document',
    );
    if (!document) return undefined;
    return elementBlocks(document).find(({ properties }) =>
      properties.some((property) => property.value === value),
    )?.line.name;
  }

  /** A path `from → … → target` through the model's dependsOn, if any. */
  private cycleFrom(
    from: string,
    target: string,
    targetDependsOn: readonly string[],
  ): string[] | null {
    const dependsOn = (id: string): string[] =>
      id === target
        ? [...targetDependsOn]
        : this.dependsOnOf(this.context.propertiesOf(id).dependsOn);
    const visit = (id: string, path: string[]): string[] | null => {
      if (id === target) return path;
      if (path.slice(0, -1).includes(id)) return null;
      for (const next of dependsOn(id)) {
        const found = visit(next, [...path, next]);
        if (found) return found;
      }
      return null;
    };
    return visit(from, [from]);
  }

  /** set by the module: the dependsOn ids of a stored value, read with this grammar */
  dependsOnOf: (value: string | undefined) => string[] = () => [];
}

export const registerRtValidationChecks = (services: {
  validation: {
    RtValidator: RtValidator;
    ValidationRegistry: {
      register: (
        checks: ValidationChecks<RtNotationAstType>,
        thisObj: unknown,
      ) => void;
    };
  };
}): void => {
  const validator = services.validation.RtValidator;
  const checks: ValidationChecks<RtNotationAstType> = {
    Document: validator.checkDocument.bind(validator),
    NodeLine: validator.checkNodeLine.bind(validator),
    AssertionValue: validator.checkAssertion.bind(validator),
    DependsOnValue: validator.checkDependsOn.bind(validator),
    RawValue: validator.checkRawValue.bind(validator),
  };
  services.validation.ValidationRegistry.register(checks, validator);
};
