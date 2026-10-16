/**
 * STS-ml's threat analysis (goal-controller#161, #160 item 1 §4): an
 * event's threat propagated to a fixpoint (IJSSE 2014 §5, Table 2 and its
 * prose; manual v2.1 App. C). The rules:
 * - an actor threatens its goals, documents, delegations and transmissions
 *   (#160 D-G7);
 * - a delegation threatens the delegator's goal;
 * - a transmission threatens the receiver's document;
 * - a goal threatens its parent when it is an AND-subgoal (D-G8), the
 *   delegator's goal when it was delegated, and the documents it produces;
 * - a document threatens the goals that read or modify it, its
 *   transmissions, and its parts (manual only, D-G9).
 *
 * Information is not threatened: neither source propagates to it. One
 * finding per event, its threatened elements and links, its direct
 * targets first.
 */
import { finding, type StsFinding } from './findings';
import { reachable, type StsIndex } from './graph';

export const threatAnalysis = (index: StsIndex): StsFinding[] => {
  const { model } = index;
  const delegations = new Map(model.delegations.map((d) => [d.id, d]));
  const transmissions = new Map(model.transmissions.map((t) => [t.id, t]));
  const goals = new Set(model.goals.map((g) => g.id));
  const documents = new Set(model.documents.map((d) => d.id));
  const actors = new Set(model.actors.map((a) => a.id));

  const next = (id: string): string[] => {
    const delegation = delegations.get(id);
    if (delegation) return [delegation.goal];
    const transmission = transmissions.get(id);
    if (transmission)
      return transmission.received !== undefined ? [transmission.received] : [];
    if (actors.has(id))
      return [
        ...model.goals.filter((g) => g.actor === id).map((g) => g.id),
        ...model.documents.filter((d) => d.actor === id).map((d) => d.id),
        ...model.delegations
          .filter((d) => d.from === id || d.to === id)
          .map((d) => d.id),
        ...model.transmissions
          .filter((t) => t.from === id || t.to === id)
          .map((t) => t.id),
      ];
    if (goals.has(id))
      return [
        ...index
          .parentsOf(id)
          .filter((p) => p.type === 'and')
          .map((p) => p.goal),
        ...index.delegationsTo(id).map((d) => d.goal),
        ...index
          .usesOfGoal(id)
          .filter((u) => u.kind === 'produce')
          .map((u) => u.document),
      ];
    if (documents.has(id))
      return [
        ...index
          .usesOfDocument(id)
          .filter((u) => u.kind !== 'produce')
          .map((u) => u.goal),
        ...index.transmissionsOf(id).map((t) => t.id),
        ...model.partOf
          .filter((p) => p.of === 'document' && p.whole === id)
          .map((p) => p.part),
      ];
    return [];
  };

  return model.events.flatMap((event) => {
    const threats = model.threats.filter((t) => t.event === event.id);
    if (!threats.length) return [];
    const targets = threats.map((t) => t.target);
    const reached = reachable(targets, next);
    const isLink = (id: string) => delegations.has(id) || transmissions.has(id);
    const elements = reached.filter((id) => !isLink(id));
    const links = [
      ...threats.flatMap((t) => (t.link !== undefined ? [t.link] : [])),
      ...reached.filter(isLink),
    ];
    const label = (id: string) => {
      const d = delegations.get(id);
      if (d) return `the delegation of "${index.name(d.goal)}"`;
      const t = transmissions.get(id);
      if (t) return `the transmission of "${index.name(t.document)}"`;
      return `"${index.name(id)}"`;
    };
    const indirect = elements.filter(
      (id) => !targets.includes(id) && !actors.has(id),
    );
    return [
      finding(
        'threatPropagation',
        'info',
        `The event "${index.name(event.id)}" threatening ${targets.map(label).join(', ')} threatens also ${indirect.length ? indirect.map(label).join(', ') : 'nothing else'}`,
        [event.id, ...elements],
        links,
        { event: event.id, threatened: elements.join(',') },
      ),
    ];
  });
};
