/**
 * A dialect's link closures (`closures`, goal-controller#210): chains of two
 * links that a third must close, and the chains a model leaves open.
 */
import type { IstarLink, IstarModel } from '@istar-ts/core';
import type { AnyDialect, LinkClosure } from '@goal-controller/dialect';

/**
 * A chain left open: `first` (from `start` to `via`) and `second` (from
 * `via` to `end`), with no link of the closure's `closedBy` from `start` to
 * `end`.
 */
export type OpenClosure = {
  closure: LinkClosure;
  first: IstarLink<string>;
  second: IstarLink<string>;
  start: string;
  via: string;
  end: string;
};

/**
 * The chains of a dialect's `closures` a model leaves open, in its links'
 * order: each link of a closure's first kind, with each link of its second
 * kind starting where it ends, when no link of `closedBy` joins the first's
 * source to the second's target.
 */
export function openClosures(
  model: IstarModel<string, string>,
  dialect: Partial<Pick<AnyDialect, 'closures'>>,
): OpenClosure[] {
  const links = [...model.links.values()];
  return (dialect.closures ?? []).flatMap((closure) => {
    const [firstKind, secondKind] = closure.path;
    const closed = new Set(
      links
        .filter((link) => link.kind === closure.closedBy)
        .map((link) => `${link.source}\u0000${link.target}`),
    );
    return links
      .filter((first) => first.kind === firstKind)
      .flatMap((first) =>
        links
          .filter(
            (second) =>
              second.kind === secondKind && second.source === first.target,
          )
          .filter(
            (second) => !closed.has(`${first.source}\u0000${second.target}`),
          )
          .map((second) => ({
            closure,
            first,
            second,
            start: first.source,
            via: first.target,
            end: second.target,
          })),
      );
  });
}
