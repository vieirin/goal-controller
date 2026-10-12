/**
 * The core's rules: name resolution over any provider's facts, and the
 * problems every pool has (an unresolved or ambiguous reference). They read
 * the relations each document's facts are loaded as:
 *
 *   defines(S, Kind, Key)   name(Id, Written)   in(Id, Document)
 *   owns(Owner, S)          typeOf(S, Type)     typeBase(S, Base)
 *   refers(R, Kind, Key)    one per kind the reference may resolve to
 *   scoped(R)               it has a scope:
 *   scope(R, Owner)           given, or
 *   via(R, R2, Through)       through what R2 resolves to
 *   kindScope(Kind, global | owner | rules)
 *
 * A Key is the name as compared (lower-cased for a case-insensitive kind).
 */

/** Relations every provider's rules may derive (they compose by union). */
export const OPEN_RELATIONS = [
  'resolves',
  'scope',
  'through',
  'typeOf',
  'typeBase',
  'problem',
];

export const CORE_RULES = `
% a reference without a scope, to a global kind: by name in the whole pool
resolves(R, S) :- refers(R, K, N), kindScope(K, global), !scoped(R), defines(S, K, N).
% a scoped one: among its scope's members
resolves(R, S) :- refers(R, K, N), scope(R, O), owns(O, S), defines(S, K, N).

% a scope through another reference: the class its target's type names, or
% what an engine's resolver (through) gives for that target
scope(R, O) :- via(R, V, type), resolves(V, X), typeBase(X, T), defines(O, _, T).
scope(R, O) :- via(R, V, Through), resolves(V, X), through(Through, X, O).

% a reference that should resolve: a global kind, one with a scope found, or
% one the provider's rules resolve
resolvable(R) :- refers(R, K, _), kindScope(K, global), !scoped(R).
resolvable(R) :- scope(R, _).
resolvable(R) :- refers(R, K, _), kindScope(K, rules).

problem(R, error, unresolved, '') :- resolvable(R), !resolves(R, _).
problem(R, warning, ambiguous, '') :- resolves(R, S1), resolves(R, S2), S1 < S2.
`;

/**
 * A rename's conflict: the new name already defined for the same kind in the
 * same scope (members of one owner, or both global). Run on the defines and
 * owns of the pool with \`rename.request(S, NewKey)\`.
 */
export const RENAME_RULES = `
rename.owned(S) :- owns(_, S).
rename.sameScope(S, S2) :- rename.request(S, _), owns(O, S), owns(O, S2).
rename.sameScope(S, S2) :- rename.request(S, N), defines(S2, _, N), !rename.owned(S), !rename.owned(S2).
rename.conflict(S2) :- rename.request(S, N), defines(S, K, _), defines(S2, K, N), S != S2, rename.sameScope(S, S2).
`;
