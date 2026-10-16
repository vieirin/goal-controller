/**
 * What the `sts` dialect says is wrong with a model, as findings
 * (goal-controller#160 D-R6, green's D-G1): the rules about one element or
 * link and its ends, which STS-Tool enforces while drawing (DKE §5.1.1,
 * the NESSoS chapter §4.2) or DKE Def. 3 states of one relationship. The
 * whole-model rules (cycles, possession through transmissions, ownership,
 * duplicate authorisations) are the well-formedness analysis's (#161,
 * ./analysis). The kinds are #160's names, so the analysis lists them with
 * its own.
 */
import type { LinkRulesDefinition } from '@goal-controller/dialect';
import type { AnalysisFinding, AnalysisLink, AnalysisModel } from '../analysis';
import {
  authorisationInvalidity,
  operationsOverlap,
  scopeOutsideAuthorisee,
} from './checks';
import { stsExtension } from './extension';
import { ISTAR, STS_LINKS } from './vocabulary';

/** The finding kinds the dialect gives (#160 D-R6). */
export const STS_PROBLEM_KINDS = {
  linkEnds: 'linkEnds',
  goalSingleDecomposition: 'goalSingleDecomposition',
  delegatedGoalNotLeaf: 'delegatedGoalNotLeaf',
  copyInSameActor: 'copyInSameActor',
  copyNameDiffers: 'copyNameDiffers',
  partOfMixed: 'partOfMixed',
  dutyMixed: 'dutyMixed',
  authorisationInvalid: 'authorisationInvalid',
  authorisationOperationsOverlap: 'authorisationOperationsOverlap',
  authorisationScopeNotAuthorisee: 'authorisationScopeNotAuthorisee',
} as const;

/** An element's text id and name: `G3: lot sold` → G3, `lot sold`. */
export const textOf = (text: string): { id: string | null; name: string } => {
  const match = /^([A-Z]{1,2}\d+):\s*(.*)$/s.exec(text);
  return match
    ? { id: match[1]!, name: match[2]!.trim() }
    : { id: null, name: text.trim() };
};

const ROLE_OR_AGENT = new Set<string>([ISTAR.role, ISTAR.agent]);

export const stsProblems = (model: AnalysisModel): AnalysisFinding[] => {
  const findings: AnalysisFinding[] = [];
  const elements = new Map(model.elements.map((e) => [e.id, e]));
  const actors = new Map(model.actors.map((a) => [a.id, a]));
  const kindOf = (id: string) => elements.get(id)?.kind ?? actors.get(id)?.kind;
  const nameOf = (id: string) => {
    const element = elements.get(id);
    return element ? element.name : (actors.get(id)?.name ?? id);
  };
  const actorOf = (id: string) => elements.get(id)?.actor;
  const add = (
    kind: keyof typeof STS_PROBLEM_KINDS,
    severity: AnalysisFinding['severity'],
    message: string,
    elementIds: readonly string[],
    link?: AnalysisLink,
  ) =>
    findings.push({
      kind: STS_PROBLEM_KINDS[kind],
      severity,
      message,
      elements: elementIds,
      links: link ? [link.id] : [],
    });

  // each link's ends, as its kind's rules say (the tool enforces them while drawing)
  const rules = new Map<string, LinkRulesDefinition>(
    stsExtension.links.map((link) => [link.kind, link.rules]),
  );
  const matches = (id: string, kinds: readonly string[]) =>
    kinds.includes(kindOf(id) ?? '');
  for (const link of model.links) {
    const rule = rules.get(link.kind);
    if (!rule) continue;
    const label = link.kind.split('.')[1]!.replace(/Link$/, '');
    if (
      !matches(link.source, rule.sources) ||
      !matches(link.target, rule.targets)
    )
      add(
        'linkEnds',
        'error',
        `A ${label} link joins ${rule.sources.map((k) => k.split('.')[1]).join(' or ')} to ${rule.targets.map((k) => k.split('.')[1]).join(' or ')}: not ${nameOf(link.source)} to ${nameOf(link.target)}`,
        [link.source, link.target],
        link,
      );
    else if (
      rule.sameActor !== false &&
      actorOf(link.source) !== actorOf(link.target)
    )
      add(
        'linkEnds',
        'error',
        `A ${label} link is within one actor's model (DKE Def. 1): ${nameOf(link.source)} and ${nameOf(link.target)} are different actors'`,
        [link.source, link.target],
        link,
      );
  }

  // refinements: each parent's children
  const children = new Map<string, string[]>();
  for (const link of model.links)
    if (link.kind === ISTAR.and || link.kind === ISTAR.or)
      children.set(link.target, [
        ...(children.get(link.target) ?? []),
        link.source,
      ]);
  for (const [parent, subgoals] of children)
    if (subgoals.length === 1)
      add(
        'goalSingleDecomposition',
        'error',
        `${nameOf(parent)} is decomposed into one subgoal, ${nameOf(subgoals[0]!)}: a decomposition has at least two (DKE Table 1)`,
        [parent, subgoals[0]!],
      );

  for (const link of model.links) {
    const copy =
      link.kind === STS_LINKS.delegates
        ? 'delegation'
        : link.kind === STS_LINKS.transmits
          ? 'transmission'
          : null;
    if (!copy) continue;
    if (actorOf(link.source) === actorOf(link.target))
      add(
        'copyInSameActor',
        'error',
        `The ${copy} of ${nameOf(link.source)} is to ${actorOf(link.target) ? 'its own actor' : 'no actor'}: a ${copy} is between two actors, the ${copy === 'delegation' ? 'delegatee' : 'receiver'} getting its own copy (DKE Def. 3(3), (5))`,
        [link.source, link.target],
        link,
      );
    const from = textOf(nameOf(link.source)).name;
    const to = textOf(nameOf(link.target)).name;
    if (from !== to)
      add(
        'copyNameDiffers',
        'warning',
        `The ${copy}'s copy is named "${to}", the original "${from}": the copy is the same ${copy === 'delegation' ? 'goal' : 'document'} (DKE Def. 3(3), (5))`,
        [link.target, link.source],
        link,
      );
    if (copy === 'delegation' && children.has(link.source))
      add(
        'delegatedGoalNotLeaf',
        'error',
        `${nameOf(link.source)} is delegated and decomposed in the delegator's model: only leaf goals are delegated (DKE Def. 3(2))`,
        [link.source],
        link,
      );
  }

  for (const link of model.links) {
    if (
      link.kind === STS_LINKS.partOf &&
      kindOf(link.source) !== kindOf(link.target)
    )
      add(
        'partOfMixed',
        'error',
        `Part-of joins two informations or two documents (the manual's Table 3): not ${nameOf(link.source)} and ${nameOf(link.target)}`,
        [link.source, link.target],
        link,
      );
    if (
      (link.kind === STS_LINKS.incompatible ||
        link.kind === STS_LINKS.combines) &&
      ROLE_OR_AGENT.has(kindOf(link.source) ?? '') !==
        ROLE_OR_AGENT.has(kindOf(link.target) ?? '')
    )
      add(
        'dutyMixed',
        'error',
        `A duty constraint is between two goals or two roles (DKE §3.2.1.3): not ${nameOf(link.source)} and ${nameOf(link.target)}`,
        [link.source, link.target],
        link,
      );
    if (link.kind !== STS_LINKS.authorises) continue;
    const where = `The authorisation from ${nameOf(link.source)} to ${nameOf(link.target)}`;
    const invalid = authorisationInvalidity(link.properties);
    if (invalid)
      add(
        'authorisationInvalid',
        'error',
        `${where}: ${invalid}`,
        [link.source, link.target],
        link,
      );
    const overlap = operationsOverlap(link.properties);
    if (overlap)
      add(
        'authorisationOperationsOverlap',
        'error',
        `${where}: ${overlap}`,
        [link.source, link.target],
        link,
      );
    const authorisee = actors.get(link.target);
    const keys = authorisee?.elements.flatMap((id) => {
      const text = textOf(nameOf(id)).id;
      return text ? [text, id] : [id];
    });
    const outside = scopeOutsideAuthorisee(link.properties, keys);
    if (outside?.length)
      add(
        'authorisationScopeNotAuthorisee',
        'error',
        `${where}: the scope is the authorisee's goals (DKE §3.1.3); ${outside.join(', ')} ${outside.length > 1 ? 'are' : 'is'} not ${nameOf(link.target)}'s`,
        [link.source, link.target],
        link,
      );
  }
  return findings;
};
