/**
 * What is wrong with a KAOS or NFR model (goal-controller#171), as problems
 * of the diagnostics protocol: each link istar-ts's validator rejects, by
 * its constraint code (DSM3's rules: `invalid-source`, `invalid-target`,
 * `duplicate-link`, `self-link`, and a hub's, `hub-target` and
 * `incomplete-hub`), anchored on the link or the hub; and each link whose
 * label isn't one its dialect's `linkLabels` lists (an NFR contribution's).
 */
import { validateModel, type IstarModel } from '@istar-ts/core';
import type { AnyDialect } from '@goal-controller/dialect';
import type { Problem } from './types';

/** A link kind as people read it: `nfr.ContributionLink` is "Contribution link". */
const linkLabel = (kind: string): string =>
  kind
    .replace(/^[^.]+\./, '')
    .replace(/Link$/, ' link')
    .replace(/([a-z])([A-Z])/g, '$1 $2');

/** The model's problems as its framework's dialect says them (source: the dialect's name). */
export const frameworkProblems = (
  model: IstarModel,
  definition: Pick<AnyDialect, 'name' | 'linkLabels'>,
): Problem[] => [
  ...validateModel(model).map((issue): Problem => ({
    severity: 'error',
    source: definition.name,
    elementId: issue.linkId,
    code: issue.code,
    message: issue.message,
  })),
  ...[...model.links.values()].flatMap((link): Problem[] => {
    const labels = definition.linkLabels?.[link.kind];
    if (!labels || (link.label !== undefined && labels.includes(link.label)))
      return [];
    return [
      {
        severity: 'error',
        source: definition.name,
        elementId: link.id,
        code: 'unknown-label',
        message: `A ${linkLabel(link.kind).toLowerCase()}'s label is one of ${labels.join(', ')}, not ${link.label === undefined ? 'none' : `"${link.label}"`}`,
      },
    ];
  }),
];
