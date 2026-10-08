import type { ValidationAcceptor, ValidationChecks } from 'langium';
import { AstUtils } from 'langium';
import {
  isRef,
  type Document,
  type NodeLine,
  type RtNotationAstType,
} from './generated/ast.js';
import type { RtCoreServices } from './module.js';
import type { RtStructure } from './structure.js';

/** Element-level checks; grammar errors and unknown ids come from Langium itself. */
export class RtValidator {
  constructor(private readonly structure: RtStructure) {}

  checkDocument(document: Document, accept: ValidationAcceptor): void {
    const seen = new Set<string>();
    let previous: NodeLine | undefined;
    for (const line of document.lines) {
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
  }

  checkNodeLine(line: NodeLine, accept: ValidationAcceptor): void {
    if (!this.structure.known) return;
    if (!this.structure.has(line.name)) {
      accept('error', 'Add this element in the diagram', {
        node: line,
        property: 'name',
      });
      return;
    }
    if (!line.notation) return;
    const children = this.structure.childrenOf(line.name) ?? [];
    const refs = AstUtils.streamAst(line.notation).filter(isRef).toArray();
    const listed = new Set(refs.map((ref) => ref.ref.$refText));
    for (const ref of refs) {
      if (!children.includes(ref.ref.$refText)) {
        accept('error', 'Not a child of this goal', { node: ref });
      }
    }
    for (const child of children) {
      if (!listed.has(child)) {
        accept('warning', `Missing from the notation: ${child}`, {
          node: line,
          property: 'notation',
        });
      }
    }
  }
}

export const registerRtValidationChecks = (services: RtCoreServices): void => {
  const validator = services.validation.RtValidator;
  const checks: ValidationChecks<RtNotationAstType> = {
    Document: validator.checkDocument.bind(validator),
    NodeLine: validator.checkNodeLine.bind(validator),
  };
  services.validation.ValidationRegistry.register(checks, validator);
};
