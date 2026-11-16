# The goal language: one model, three dialects

A drone delivers a sample. This page writes it in edgeV2, in Edge, and in
edgeV2 with piStar-ext's annotations (iStar4RationalAgents). Each block is
validated in its dialect by `packages/lib/test/dialect/docs.test.ts`. Each
element line starts with its kind's word (`goal`, `task`, `resource`). A
block with no diagnostic lines (`%% error …`) gives no diagnostics at all;
`%% variables` names the workbench's variables (`battery`).

## EdgeV2

EdgeV2 enables `@ | ? + # ; ->`. A choice is `?` and any order is `+`.
Goals read the properties `maintain`, `assertion`, `dependsOn`,
`variables`, `utility`, `cost`, `maxRetries`, `type` and `root`; tasks read
`assertion`, `maxRetries`, `utility`, `cost` and `type`. Resources declare
`{type lower..upper = initial}`.

```goal-check edgeV2
goal G1: Deliver sample [G2;G3]
  root
goal G2: Collect sample [T1?T2]
  assertion battery > 20
  task T1: Use arm
    maxRetries 3
  task T2: Use gripper
goal G3: Bring to lab [T3@2->T4]
  task T3: Fly direct
  task T4: Drive around
resource R1: Battery {int 0..100 = 80}
%% variables battery
```

What the engine reads of each goal:

```goal-reads edgeV2
G1: Deliver sample [G2;G3] ⇒ sequence(G2, G3)
G2: Collect sample [T1?T2] ⇒ choice(T1, T2)
G3: Bring to lab [T3@2->T4] ⇒ degradation(T3, T4) retry{T3:2}
```

## Edge

Edge (v1) enables `@ | # ; ->`, and a choice is a standalone `+`. It reads
the same properties.

```goal-check edge
goal G1: Deliver sample [G2;G3]
  root
goal G2: Collect sample [+]
  assertion battery > 20
  task T1: Use arm
    maxRetries 3
  task T2: Use gripper
goal G3: Bring to lab [T3@2->T4]
  task T3: Fly direct
  task T4: Drive around
resource R1: Battery {int 0..100 = 80}
%% variables battery
```

```goal-reads edge
G2: Collect sample [+] ⇒ choice()
G3: Bring to lab [T3@2->T4] ⇒ degradation(T3, T4) retry{T3:2}
```

## EdgeV2 with piStar-ext's annotations

`withExtension(edgeV2, istar4RationalAgents)` makes every kind
`annotated`. A line then starts with its stereotype and tagged value, which
set the properties `stereotype`, `tag` and `tagValue`. Tasks may be
`<<action>>`, with a `type` tag of `duty` or `right`.

```goal-check edgeV2+rationalAgents
{Id = G1} goal G1: Deliver sample [G2;G3]
  root
goal G2: Collect sample [T1?T2]
  assertion battery > 20
  <<action>> {type = duty} task T1: Use arm
    maxRetries 3
  <<action>> {type = right} task T2: Use gripper
goal G3: Bring to lab [T3@2->T4]
  task T3: Fly direct
  task T4: Drive around
resource R1: Battery {int 0..100 = 80}
%% variables battery
```

## piStar-ext's own definition

`dialectDefinition(istar4RationalAgents)` is piStar-ext with no engine:
every iStar kind and the dialect's own, no notation, no property lines, and
no runtime ids. Each line starts with its kind's word (`agent`, `goal`,
`task`, `planning`), and its id, when it has one, is the element's own
(`G1`, or any word: `net_up`). Written into an empty model (`%% only none`:
the diagram has nothing yet), each line creates its element; a line with no
id gets its piStar id's first 8 characters when the editor writes it
(`goal 7857cb00: Bring to lab`).

```goal-check rationalAgents
<<goal-based>> agent Drone
  goal G1: Deliver sample
  <<action>> {type = duty} task T1: Use arm
  goal Bring to lab
%% only none
```

## What each dialect reports in the others' text

Edge reads edgeV2's choice as an operator it doesn't have:

```goal-check edge
goal G2: Collect sample [T1?T2]
%% error [?] `?` is not an operator of Edge
```

EdgeV2 has no standalone `+`:

```goal-check edgeV2
goal G2: Collect sample [+]
%% error [+] A standalone `+` is not a construct of EdgeV2
```

Plain edgeV2 has no annotations:

```goal-check edgeV2
<<action>> {type = duty} task T1: Use arm
%% error [<<action>>] A task carries no annotations in EdgeV2
%% error [{type = duty}] A task carries no annotations in EdgeV2
```

Edge with the annotations still has no `+` between operands:

```goal-check edge+rationalAgents
<<action>> task T1: Use arm
goal G2: Collect sample [T1+T2]
%% error [+] `+` is not an operator of Edge + iStar4RationalAgents
```

A tag value outside the listed ones is reported, because `type`'s values
are listed and that enum isn't open:

```goal-check edgeV2+rationalAgents
{type = maybe} task T1: Use arm
%% error [{type = maybe}] One of duty, right, not maybe
```
