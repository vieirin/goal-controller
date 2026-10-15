/*
 * The iStar-DT oracle's runner (#117 D1.2): runs every `.pl` in a directory
 * with run.pl, each in a fresh SWI-Prolog (DT-Golog's clauses are global),
 * and writes its result to `<name>.txt` in the out directory (run.pl's
 * output, or `ERROR: <exit status>`).
 *
 *   swipl oracle.pl <specs directory> <out directory>
 */
:- initialization(main, main).

main([Specs, Out]) :-
    directory_files(Specs, Files),
    msort(Files, Sorted),
    forall(( member(File, Sorted), file_name_extension(Base, pl, File) ),
           run_one(Specs, Out, Base, File)).

run_one(Specs, Out, Base, File) :-
    directory_file_path(Specs, File, Spec),
    file_name_extension(Base, txt, Name),
    directory_file_path(Out, Name, Result),
    format(user_error, "~w~n", [File]),
    process_create(path(swipl), ['/oracle/run.pl', '--', Spec],
                   [stdout(pipe(Output)), stderr(null), process(Pid)]),
    read_string(Output, _, Text), close(Output),
    process_wait(Pid, Status),
    (   Status == exit(0), Text \== ""
    ->  Written = Text
    ;   format(string(Written), "~wERROR: ~w~n", [Text, Status])
    ),
    setup_call_cleanup(open(Result, write, Stream),
                       write(Stream, Written), close(Stream)).
