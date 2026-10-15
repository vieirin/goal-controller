/*
 * What a dtx2dtg program calls and no published file defines (dtg2sim and
 * RLGen at their latest commits define neither): a quality's initial value,
 * whether a condition holds at the start, and a fluent's truth as 1 or 0.
 * goal-controller's, read from how the generated programs use them
 * (#119): `cost(V_init,s0) :- getInitValue(cost,V_init),!.`,
 * `hvacOn_fl(s0) :- !,initiallyTrue(hvacOn_fl).`,
 * `val(R_x_fl,x_fl(S))` in a quality's sum.
 */
:- multifile getInitValue/2.
:- multifile initiallyTrue/1.
:- multifile val/2.

/* the value `init/1` gives an element (`cost(0)`); none: no clause */
getInitValue(Name, Value) :- init(Initial), member(Term, Initial),
                             Term =.. [Name, Value], !.

/* a fluent `init/1` lists (`hvacOn_fl`) */
initiallyTrue(Fluent) :- init(Initial), memberchk(Fluent, Initial).

/* 1 when the goal holds, 0 otherwise */
val(1, Goal) :- call(Goal), !.
val(0, _).

/*
 * ECLiPSe's builtins DT-Golog's `bp/6` writes its report with (RLGen's
 * patches for SWI-Prolog leave them out): `printf/2,3` with `%w`, and
 * `date/1`.
 */
printf(Format, Args) :- current_output(Stream), printf(Stream, Format, Args).
printf(Stream, Format, Args) :-
    split_string(Format, "%", "", [First|Rest]),
    foldl([Part, Acc0, Acc]>>( sub_string(Part, 0, 1, _, "w")
                               -> sub_string(Part, 1, _, 0, Tail),
                                  string_concat(Acc0, "~w", Acc1),
                                  string_concat(Acc1, Tail, Acc)
                               ;  string_concat(Acc0, "%", Acc1),
                                  string_concat(Acc1, Part, Acc) ),
          Rest, First, Swi),
    format(Stream, Swi, Args).

:- if(\+ current_predicate(date/1)).
date(Date) :- get_time(Now), format_time(atom(Date), '%FT%T', Now).
:- endif.
