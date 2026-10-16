/**
 * The `sts` dialect's model as the analyses read it (#160 D-R4/D-R5, red's
 * kinds): iStar 2.0's roles, agents, goals and resources (documents),
 * with the dialect's information and events, and its links. A delegation
 * runs from the delegator's goal to the delegatee's copy of it, a
 * transmission from the sender's resource to the receiver's copy. An
 * authorisation runs between actors. A delegation or transmission is
 * threatened through its `threatenedBy` events, since a link can't target
 * a link.
 */
import { readEnumSet } from '@goal-controller/goal-language';
import type { AnalysisLink, AnalysisModel } from '../../analysis';
import {
  OPERATIONS,
  type Operation,
  type StsDecomposition,
  type StsModel,
} from './model';

/**
 * The dialect's kinds the analyses read. Restated from red's
 * `../vocabulary` (#163) until it is on main; then imported from there.
 */
export const STS_KINDS = {
  role: 'istar.Role',
  agent: 'istar.Agent',
  goal: 'istar.Goal',
  document: 'istar.Resource',
  information: 'sts.Information',
  event: 'sts.Event',
  and: 'istar.AndRefinementLink',
  or: 'istar.OrRefinementLink',
  contribution: 'istar.ContributionLink',
  plays: 'istar.ParticipatesInLink',
  delegates: 'sts.DelegatesLink',
  transmits: 'sts.TransmitsLink',
  reads: 'sts.ReadsLink',
  modifies: 'sts.ModifiesLink',
  produces: 'sts.ProducesLink',
  owns: 'sts.OwnsLink',
  tangibleBy: 'sts.TangibleByLink',
  partOf: 'sts.PartOfLink',
  authorises: 'sts.AuthorisesLink',
  incompatible: 'sts.IncompatibleLink',
  combines: 'sts.CombinesLink',
  threatens: 'sts.ThreatensLink',
} as const;

/** An element's text id, as cgm's model reads one (`G3` of `G3: data refined`). */
const TEXT_ID = /^\s*([A-Za-z]+\d+(?:\.\d+)*)\s*:/;

/** A `refList`'s items, trimmed, as the engines read one (`edgeFamily`'s `dependsOn`). */
const items = (text: string | undefined): string[] =>
  (text ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * The security needs a delegation's or a transmission's properties
 * express, by the analyses' names: a bool need by its key, an enum need as
 * its key and value (`redundancy` `trueMultiActor` → `trueRedundancyMulti`,
 * `authentication` `delegatee` → `delegateeAuthentication`).
 */
const needsOf = (properties: Readonly<Record<string, string>>): string[] => {
  const needs: string[] = [];
  for (const [key, value] of Object.entries(properties)) {
    if (!value || value === 'false') continue;
    switch (key) {
      case 'noRedelegation':
      case 'trustworthiness':
        needs.push(key);
        break;
      case 'redundancy': {
        const [, kind, actors] =
          /^(true|fallback)(Single|Multi)Actor$/.exec(value) ?? [];
        if (kind && actors) needs.push(`${kind}Redundancy${actors}`);
        break;
      }
      case 'nonRepudiation':
        for (const part of value === 'delegationAcceptance'
          ? ['delegation', 'acceptance']
          : value === 'transferAcceptance'
            ? ['transfer', 'acceptance']
            : [value])
          needs.push(
            `nonRepudiationOf${part[0]!.toUpperCase()}${part.slice(1)}`,
          );
        break;
      case 'authentication':
      case 'integrity':
      case 'confidentiality':
        for (const who of [value])
          needs.push(`${who}${key[0]!.toUpperCase()}${key.slice(1)}`);
        break;
      case 'availability':
        needs.push('availability');
        break;
    }
  }
  return needs;
};

/** An `enumSet` of operations (`granted`, `prohibited`), by `readEnumSet`. */
const operations = (text: string | undefined): Operation[] =>
  (readEnumSet(text ?? '') ?? []).filter((x): x is Operation =>
    (OPERATIONS as readonly string[]).includes(x),
  );

/** Reads the analyses' model from the dialect's. */
export const readStsModel = (model: AnalysisModel): StsModel => {
  const K = STS_KINDS;
  const elementActor = new Map(
    model.elements.flatMap((e) =>
      e.actor !== undefined ? [[e.id, e.actor] as const] : [],
    ),
  );
  /**
   * A reference in a `refList`, to a piStar id: the element whose text id
   * it is (`I2` of `I2: personal info`), or else the piStar id itself, as
   * cgm's `byId` reads one.
   */
  const byText = new Map<string, string>();
  for (const e of model.elements) {
    const textId = TEXT_ID.exec(e.name)?.[1];
    if (textId && !byText.has(textId)) byText.set(textId, e.id);
  }
  const resolve = (ref: string) => byText.get(ref) ?? ref;
  const refs = (text: string | undefined) => items(text).map(resolve);
  const linksOf = (kind: string): AnalysisLink[] =>
    model.links.filter((l) => l.kind === kind);

  const delegates = linksOf(K.delegates);
  const transmits = linksOf(K.transmits);
  const received = new Set(transmits.map((t) => t.target));
  const produced = new Set(linksOf(K.produces).map((p) => p.target));

  const decompositions = new Map<string, StsDecomposition>();
  for (const link of model.links) {
    if (link.kind !== K.and && link.kind !== K.or) continue;
    const parent = link.target;
    const existing = decompositions.get(parent);
    decompositions.set(parent, {
      goal: parent,
      type: existing?.type ?? (link.kind === K.and ? 'and' : 'or'),
      subgoals: [...(existing?.subgoals ?? []), link.source],
      links: [...(existing?.links ?? []), link.id],
    });
  }

  return {
    actors: model.actors
      .filter((a) => a.kind === K.role || a.kind === K.agent)
      .map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind === K.agent ? 'agent' : 'role',
      })),
    goals: model.elements
      .filter((e) => e.kind === K.goal && e.actor !== undefined)
      .map((e) => ({ id: e.id, name: e.name, actor: e.actor! })),
    documents: model.elements
      .filter((e) => e.kind === K.document && e.actor !== undefined)
      .map((e) => ({
        id: e.id,
        name: e.name,
        actor: e.actor!,
        possessed: !received.has(e.id) && !produced.has(e.id),
      })),
    information: model.elements
      .filter((e) => e.kind === K.information)
      .map((e) => ({ id: e.id, name: e.name })),
    decompositions: [...decompositions.values()],
    uses: [
      ...linksOf(K.reads).map((l) => ['read', l] as const),
      ...linksOf(K.modifies).map((l) => ['modify', l] as const),
      ...linksOf(K.produces).map((l) => ['produce', l] as const),
    ].map(([kind, l]) => ({
      id: l.id,
      kind,
      goal: l.source,
      document: l.target,
    })),
    delegations: delegates.map((l) => ({
      id: l.id,
      from: elementActor.get(l.source) ?? '',
      to: elementActor.get(l.target) ?? '',
      goal: l.source,
      received: l.target,
      needs: needsOf(l.properties),
      ...(l.properties.availability && {
        availability: l.properties.availability,
      }),
    })),
    transmissions: transmits.map((l) => ({
      id: l.id,
      from: elementActor.get(l.source) ?? '',
      to: elementActor.get(l.target) ?? '',
      document: l.source,
      received: l.target,
      needs: needsOf(l.properties),
      ...(l.properties.availability && {
        availability: l.properties.availability,
      }),
    })),
    authorisations: linksOf(K.authorises).map((l) => ({
      id: l.id,
      from: l.source,
      to: l.target,
      information: refs(l.properties.information),
      scope: refs(l.properties.scope),
      granted: operations(l.properties.granted),
      prohibited: operations(l.properties.prohibited),
      transferable: l.properties.transferable !== 'false',
    })),
    ownerships: linksOf(K.owns).map((l) => ({
      id: l.id,
      actor: l.source,
      information: l.target,
    })),
    tangible: linksOf(K.tangibleBy).map((l) => ({
      id: l.id,
      information: l.source,
      document: l.target,
    })),
    partOf: linksOf(K.partOf).map((l) => ({
      id: l.id,
      of:
        model.elements.find((e) => e.id === l.source)?.kind === K.information
          ? 'information'
          : 'document',
      part: l.source,
      whole: l.target,
    })),
    plays: linksOf(K.plays).map((l) => ({
      id: l.id,
      agent: l.source,
      role: l.target,
    })),
    duties: [
      ...linksOf(K.incompatible).map((l) => ['sod', l] as const),
      ...linksOf(K.combines).map((l) => ['cod', l] as const),
    ].map(([type, l]) => ({
      id: l.id,
      type,
      of: model.actors.some((a) => a.id === l.source) ? 'role' : 'goal',
      first: l.source,
      second: l.target,
    })),
    contributions: linksOf(K.contribution).map((l) => ({
      id: l.id,
      from: l.source,
      to: l.target,
      sign: l.label === 'hurt' || l.label === 'break' ? '-' : '+',
    })),
    events: model.elements
      .filter((e) => e.kind === K.event)
      .map((e) => ({ id: e.id, name: e.name })),
    threats: [
      ...linksOf(K.threatens).map((l) => ({
        event: l.source,
        target: l.target,
        link: l.id,
      })),
      ...[...delegates, ...transmits].flatMap((l) =>
        refs(l.properties.threatenedBy).map((event) => ({
          event,
          target: l.id,
        })),
      ),
    ],
  };
};
