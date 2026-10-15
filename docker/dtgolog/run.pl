/*
 * One program, in its own SWI-Prolog: loads DT-Golog through dtg2sim's
 * interface, the shim and the program, and runs the program's own
 * `dtgRun(Policy, Utility, Probability)` (`bp(root, 10, …)`, as dtx2dtg
 * writes it). Prints
 *
 *   Utility: 0.9235
 *   Probability: 1.0
 *   Policy: <the policy term>
 *
 * or `ERROR: <why>`.
 *
 *   swipl run.pl -- <program.pl>  (after `--`: else swipl loads it first)
 */
:- initialization(main, main).

main([Spec]) :-
    catch(( % the interface consults DT-Golog.pl from the working directory
            working_directory(_, '/oracle'),
            consult('/oracle/DT-Golog-Iface.pl'),
            consult('/oracle/shim.pl'),
            consult(Spec),
            % bp writes the policy to a file named `x`: somewhere of its own
            tmp_file(dtgolog, Dir), make_directory(Dir),
            working_directory(_, Dir),
            (   call(dtgRun, Policy, Utility, Probability)
            ->  format("Utility: ~w~nProbability: ~w~nPolicy: ~q~n",
                       [Utility, Probability, Policy])
            ;   format("ERROR: dtgRun failed~n")
            )
          ),
          Error,
          format("ERROR: ~q~n", [Error])).
