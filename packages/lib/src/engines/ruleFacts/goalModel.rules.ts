// Generated from goalModel.rls by scripts/rules.mjs: edit the .rls file.
export default "% A goal model's rules, for any engine (goal-controller#75; goalModel.ts\n% reads the facts): an id a notation lists is one of the element's children.\nresolves(?R, ?S) :- refers(?R, \"gm.child\", ?N), scope(?R, ?O), owns(?O, ?S), defines(?S, _, ?N), gm_element(?S) .\n";
