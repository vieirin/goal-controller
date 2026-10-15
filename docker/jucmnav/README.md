# jUCMNav as GRL's oracle

GRL's evaluations (goal-controller #106) are checked against jUCMNav's own, #105 D1.

**What it does.** The image builds [JUCMNAV/jUCMNavPlus](https://github.com/JUCMNAV/jUCMNavPlus) at a pinned commit (`JUCMNAV_COMMIT` in the Dockerfile), with Java 21, Maven, Tycho and Eclipse inside the image. It adds `OracleTest.java` to jUCMNav's test fragment and runs it alone, under a virtual display, as jUCMNav's CI runs its tests. For every `.jucm` in the seeds directory, the test calls `BatchEvaluationUtil.calculateAllEvaluations` under three settings:
- quantitative at tolerance 0;
- quantitative at tolerance 10 (jUCMNav's default);
- qualitative.

It writes one CSV per seed:

```
algorithm,tolerance,strategy,strategyName,kind,id,value,label
```

**How to run it.** Docker only: nothing is installed on the host.

```sh
docker/jucmnav/run.sh <seeds directory> <output directory>
```

The first build takes a few minutes, since Tycho downloads an Eclipse; it is cached after that.

**What it changes in a seed before it loads it.** None of these changes what is evaluated (`OracleTest.load`):
- jUCMNav's 2014 files name their features `grl:Feature`, with an element type `Feature`. jUCMNavPlus moved them to its `fm` package and has no such type, so they become `fm:Feature`, of type Task.
- GoalCat gives its `LinkRef`s ids and has links refer to them (`refs`). jUCMNavPlus's `LinkRef` has no id, so a link's `refs` (its drawings) are removed.
- GoalCat names a link's ends on the link only. jUCMNav resolves them from the elements' `linksSrc`/`linksDest`, which are written from the links.

Attributes jUCMNavPlus doesn't know are kept aside, not errors (`OPTION_RECORD_UNKNOWN_FEATURE`).

**Licence.** jUCMNav is EPL-1.0. The image builds it and nothing of it is committed here; `OracleTest.java` is goal-controller's.
