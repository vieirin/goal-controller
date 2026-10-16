/**
 * Small STS-ml models for the analyses' tests (goal-controller#161 item
 * 5), built as the dialect's model (#160 D-R4/D-R5): actors, goals and
 * resources with their links, each by a short id the test names. Each
 * element's text gives it a text id (`G3: G`), which a `refList` names.
 */
import type {
  AnalysisActor,
  AnalysisElement,
  AnalysisLink,
  AnalysisModel,
} from '../../../../src/engines/analysis';
import { STS_KINDS as K } from '../../../../src/engines/sts/analysis';

export const stsModel = () => {
  const actors: AnalysisActor[] = [];
  const elements: AnalysisElement[] = [];
  const links: AnalysisLink[] = [];
  let next = 0;
  const textIds = new Map<string, string>();
  const PREFIX: Record<string, string> = {
    [K.goal]: 'G',
    [K.document]: 'R',
    [K.information]: 'I',
    [K.event]: 'E',
  };
  /** The text id a `refList` names an element by. */
  const ref = (id: string) => textIds.get(id) ?? id;
  const refs = (ids: readonly string[]) => ids.map(ref).join(', ');
  const link = (
    kind: string,
    source: string,
    target: string,
    properties: Record<string, string> = {},
    label?: string,
  ) => {
    const id = `l${next++}`;
    links.push({
      id,
      kind,
      source,
      target,
      properties,
      ...(label && { label }),
    });
    return id;
  };
  const element = (kind: string, id: string, actor?: string) => {
    const textId = `${PREFIX[kind] ?? 'X'}${textIds.size + 1}`;
    textIds.set(id, textId);
    elements.push({
      id,
      kind,
      name: `${textId}: ${id}`,
      properties: {},
      ...(actor !== undefined && { actor }),
    });
    const owner = actors.find((a) => a.id === actor);
    if (owner) (owner.elements as string[]).push(id);
    return id;
  };
  const b = {
    role: (id: string) => {
      actors.push({ id, kind: K.role, name: id, properties: {}, elements: [] });
      return id;
    },
    agent: (id: string) => {
      actors.push({
        id,
        kind: K.agent,
        name: id,
        properties: {},
        elements: [],
      });
      return id;
    },
    goal: (actor: string, id: string) => element(K.goal, id, actor),
    document: (actor: string, id: string) => element(K.document, id, actor),
    information: (id: string) => element(K.information, id),
    event: (id: string) => element(K.event, id),
    and: (parent: string, children: string[]) =>
      children.map((c) => link(K.and, c, parent)),
    or: (parent: string, children: string[]) =>
      children.map((c) => link(K.or, c, parent)),
    /** Delegates a goal: the delegatee's copy is `${goal}@${to}`. */
    delegate: (
      goal: string,
      to: string,
      properties: Record<string, string> = {},
    ) => {
      const copy = element(K.goal, `${goal}@${to}`, to);
      return { copy, link: link(K.delegates, goal, copy, properties) };
    },
    /** Transmits a document: the receiver's copy is `${document}@${to}`. */
    transmit: (
      document: string,
      to: string,
      properties: Record<string, string> = {},
    ) => {
      const copy = element(K.document, `${document}@${to}`, to);
      return { copy, link: link(K.transmits, document, copy, properties) };
    },
    reads: (goal: string, document: string) => link(K.reads, goal, document),
    modifies: (goal: string, document: string) =>
      link(K.modifies, goal, document),
    produces: (goal: string, document: string) =>
      link(K.produces, goal, document),
    owns: (actor: string, information: string) =>
      link(K.owns, actor, information),
    tangible: (information: string, document: string) =>
      link(K.tangibleBy, information, document),
    partOf: (part: string, whole: string) => link(K.partOf, part, whole),
    authorise: (
      from: string,
      to: string,
      a: {
        information: string[];
        scope?: string[];
        granted?: string[];
        prohibited?: string[];
        transferable?: boolean;
      },
    ) =>
      link(K.authorises, from, to, {
        information: refs(a.information),
        scope: refs(a.scope ?? []),
        granted: (a.granted ?? []).join(', '),
        prohibited: (a.prohibited ?? []).join(', '),
        transferable: String(a.transferable ?? true),
      }),
    plays: (agent: string, role: string) => link(K.plays, agent, role),
    sod: (a: string, c: string) => link(K.incompatible, a, c),
    cod: (a: string, c: string) => link(K.combines, a, c),
    threatens: (event: string, target: string) =>
      link(K.threatens, event, target),
    contributes: (from: string, to: string, label: 'help' | 'hurt') =>
      link(K.contribution, from, to, {}, label),
    ref,
    /** Sets a property of a link (`threatenedBy` on a delegation, by `ref`). */
    set: (id: string, key: string, value: string) => {
      const l = links.find((x) => x.id === id)!;
      (l.properties as Record<string, string>)[key] = value;
    },
    model: (): AnalysisModel => ({ actors, elements, links }),
  };
  return b;
};
