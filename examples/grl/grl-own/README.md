# GRL: Home heating (grl-own.jucm)

**What it exercises:** every construct the GRL dialect reads, in one model of ours small enough to check by hand (goal-controller #106, #105 D7). It has:
- two actors with importance;
- a softgoal with an importance;
- an indicator valued by a KPI value set (with a decimal measure);
- a belief and its belief link;
- Make, Help, SomePositive (a correlation), Unknown, Hurt and Break contributions, one with no weight (jUCMNav's default 25);
- an Xor decomposition (#105 D6) and an And one;
- a dependency through a dependum, across the two actors;
- two strategies, one including the other.

Its values reach:
- the tolerance band: Comfort is 100 at tolerance 0 and 90 at tolerance 10;
- a dependency's cap: "Keep the home warm" is held at the dependum's 60;
- saturation at both ends.

- **Source:** written for goal-controller as a jUCMNav `.jucm` (EMF XMI 2.0, both sides of each link as jUCMNav writes them). jUCMNavPlus loads it as written.
- **Licence:** the repository's.
- **What is in the project:**
  - `grl-own.jucm`: the source.
  - `grl-own.txt`: the model `importJucm` makes of it.
  - `strategies/Heating.json`: the "Heat pump" and "Gas boiler" strategies.
  - `reference/evaluations.csv`: jUCMNav's evaluation of both strategies, from the oracle (`docker/jucmnav/`, jUCMNavPlus `ffe86d60`): quantitative at tolerance 0 and 10, qualitative.
- **In the Notation view** (goal-controller#109), the home owner's importance is its actor line, the document's first: `actor "Home owner" {importance = High} {importanceQuantitative = 80}`. The utility company sets none, so it has no line.
- **Checked by:** `pnpm stress:grl` against `reference/`; lib's tests compute its values by hand from the Java source.
