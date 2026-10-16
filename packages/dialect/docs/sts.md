# STS-ml: a stress test of the engine framework

STS-ml (Paja, Dalpiaz, Giorgini; DISI Trento, 2011–2016) is an actor- and goal-oriented language for **security requirements of socio-technical systems**. One model has three views:
- the **social view**: actors, their goals and documents, goal delegations and document transmissions;
- the **information view**: what information the documents make tangible, and who owns it;
- the **authorisation view**: the permissions and prohibitions actors pass on information.

Actors annotate their delegations and transmissions with **security needs**. An authorisation implies needs of its own. From the needs, STS-Tool derives **security requirements**, as commitments between actors, and checks the model with three **design-time analyses**: well-formedness, security, and threat propagation.

It is goal-controller's eighth stress test (#28), the "mostly a metamodel" case. It was planned on #160, where decisions D1–D3, D-R1–D-R10 (red), D4–D7 (blue) and D-G1–D-G12 (green) are logged.
- **The dialect, its seeds and STS-Tool's file** are #163 (red, this page).
- **The framework's growth** is #162 (blue).
- **The analyses and the derived requirements** are #161 (green).

## Sources

| Id | Source |
|---|---|
| S1 | Paja, Dalpiaz, Giorgini, *Modelling and reasoning about security requirements in socio-technical systems*, DKE 98 (2015): the language, its formal framework, and the TasLab case |
| S3 | *Socio-Technical Security Modeling Language*, manual for STS-Tool 2.0 & 2.1 (UniTN): the stay-permit running example, and the analyses in its Appendix |
| S5 | Paja, Dalpiaz, Giorgini, *STS-Tool*, LNCS 8431 (2014): travel planning (§2) and eGov lot searching (§4), for STS-Tool v1.3 |
| S2 | Meland et al., *Threat Analysis in Goal-Oriented Security Requirements Modelling*, IJSSE 5(2) (2014): the ATM case |
| S8 | the three tutorial projects on [sts-tool.eu/tutorials](https://www.sts-tool.eu/tutorials) (eGov, Healthcare, TasLab), with their generated reports |

The version followed is STS-Tool 2.x and S1 (#160 D-R3): read, modify, produce and transmit. S5's v1.3 calls them use, modify, produce and distribute, and calls *read* "need" and *transmission* "provision".

**Secure Tropos** (Mouratidis, Giorgini) is not this dialect (#160 D-R1). It shares only actor and goal with STS-ml. Its security constraints, secure dependencies, attacks and mechanisms are another vocabulary, and no tool or model of it can be tested against. It would be a dialect of its own over iStar 2.0 dependencies, in a later round.

## What the dialect reads

`packages/lib/src/engines/sts/`: the `sts` extension (`extension.ts`), the definition (`definition.ts`), its words (`vocabulary.ts`).

| STS-ml | piStar | Line |
|---|---|---|
| role, agent | `istar.Role`, `istar.Agent` | `actor "Tourist"` |
| agent plays role | `istar.ParticipatesInLink` | |
| goal, AND/OR decomposition | `istar.Goal`, `istar.AndRefinementLink`/`istar.OrRefinementLink` (child → parent) | `G1: Trip planned` |
| document (possessed: in the actor) | `istar.Resource` | `R1: Traveling Order` |
| information | `sts.Information`, outside actors | `I1: Personal data` |
| event | `sts.Event`, outside actors | `E1: ID Doc stolen` |
| goal delegation | `sts.DelegatesLink`: the delegator's goal → **the delegatee's copy**, a goal of the same name in the delegatee | `link G4 {…}` under G2 |
| document transmission | `sts.TransmitsLink`: the sender's document → **the receiver's copy** | `link R3 {…}` under R1 |
| read, modify, produce | `sts.ReadsLink`, `sts.ModifiesLink`, `sts.ProducesLink`: goal → document of its actor | |
| own | `sts.OwnsLink`: actor → information | `link I1` under `actor "Tourist"` |
| tangible by | `sts.TangibleByLink`: information → document | |
| part of | `sts.PartOfLink`: part → whole, information–information or document–document | |
| threatens | `sts.ThreatensLink`: event → goal, document or actor | |
| separation, combination of duties | `sts.IncompatibleLink`, `sts.CombinesLink`: goal–goal or role–role | |
| authorisation | `sts.AuthorisesLink`: authoriser → authorisee | `link actor "TAS" {…}` under `actor "Tourist"` |
| goal contribution (++, −−) | `istar.ContributionLink` goal → goal, `help` / `hurt` | |

**A delegation joins the original to its copy**, as STS-Tool's file does: its GoalReference and DocumentReference (#160 D-R4). The copy is the delegatee's own goal. It may decompose it and delegate its parts on. The link says which goal it is: the copy keeps the original's name, and a dialect check warns when it doesn't.

### Properties (#160 D-R5)

| On | Key | Value |
|---|---|---|
| delegation | `noRedelegation`, `trustworthiness` | bool |
| | `nonRepudiation` | `acceptance` · `delegation` · `delegationAcceptance` |
| | `redundancy` | `trueSingleActor` · `trueMultiActor` · `fallbackSingleActor` · `fallbackMultiActor` |
| | `availability` | int 0–100 (percent) |
| | `authentication` | `delegator` · `delegatee` |
| transmission | `integrity`, `confidentiality` | `sender` · `receiver` · `system` |
| | `availability` | int 0–100 |
| | `authentication` | `sender` · `receiver` |
| | `nonRepudiation` | `transfer` · `acceptance` · `transferAcceptance` |
| both | `threatenedBy` | refList of events (a link can't be a threat's target) |
| authorisation | `granted`, `prohibited` | **enumSet** of `read`, `modify`, `produce`, `transmit`; an operation in neither is unspecified |
| | `information` | refList of information, at least one |
| | `scope` | refList of the authorisee's goals; none: any goal |
| | `transferable` | bool, default true |
| goal, document, information, event | `description` | text |

**One key per need, not one set.** Each need carries its own parameter, so a set of needs plus their parameters would say each need twice. The operations are a set, so they are written as one: `{granted = read, produce}`. An authorisation's own needs (need-to-know, non-reading, …, non-reauthorisation) are what its operations, scope and transferability imply (S1 §3.2.2). The analyses derive them.

**Engines read a refList with `refListItems`** (`vocabulary.ts`), on the goal language's `parseValue('refList', …)`, and never split the text. They read an enumSet with `readEnumSet`.

### Views

`views: social, information, authorisation` (#162's A3) filter one diagram by kind. The authorisation view shows actors and information only. An authorisation's scope names goals it doesn't draw.

### The dialect's checks (#160 D-R6)

The named checks (`checks.ts`) cover the authorisation's properties:
- an operation both granted and prohibited;
- no information, or nothing granted or prohibited (S1 Def. 3(6));
- a scope goal that isn't the authorisee's.

`stsProblems(model)` (`problems.ts`) says what concerns one element or link and its ends, as findings (#162's A4). The engine's *Dialect checks* analysis lists them.

| Kind | Rule |
|---|---|
| `linkEnds` | a link's ends are its kind's (the tool enforces them while drawing); goal–document links within one actor (S1 Def. 1) |
| `goalSingleDecomposition` | a decomposition has at least two subgoals (S1 Table 1) |
| `delegatedGoalNotLeaf` | only leaf goals are delegated (S1 Def. 3(2)) |
| `copyInSameActor` | a delegation or transmission is between two actors (S1 Def. 3(3), (5)) |
| `copyNameDiffers` (warning) | the copy keeps the original's name |
| `partOfMixed` | part-of between two informations or two documents |
| `dutyMixed` | SoD/CoD between two goals or two roles |
| `authorisationInvalid`, `authorisationOperationsOverlap`, `authorisationScopeNotAuthorisee` | the named checks', as findings |

The whole-model rules are #161's well-formedness analysis: cycles, possession through transmissions, ownership, duplicate authorisations, contribution cycles (#160 D-G1).

*Delegated Goal Part Of a Decomposition* (S8's reports, App. B) is in neither (#160 D-R10). Read as "a received goal is never a subgoal", it fires on 11 copies in the tutorial models, which the tool itself passes.

## STS-Tool's file: `.sts` (#160 D-R9)

`engines/sts/native/` is the dialect's native file, `.sts`, read and written: EMF XMI with a flat `<elements xsi:type="ststool:…">` list, referenced by path (`//@elements.N`). The format is documented on #160 from S8's files only. The reader:
- maps each type to the table above;
- reads security needs (`<elementNeeds elementNeedID="…securityrequirements.X">`, with `type` and `value` properties) as the keys above;
- reads an authorisation's `read`/`modification`/`produce`/`transmit`, each `AUTHORIZED`, `FORBIDDEN` or absent, as granted, prohibited or unspecified;
- numbers texts by kind in the file's order (`G1`, `R1`, `I1`, `E1`).

The writer writes both ends of every reference, as EMF does, each kind in its ids' order, so a model reads back as itself.

**Lossy:**
- the display;
- the diagram's extent;
- the positions of information and events, which are drawn in other views;
- a seed's `source`;
- **contributions**: none of the published files holds one, so their type is unknown, and the writer warns;
- **`threatenedBy`**: no published file puts an event on a delegation or a transmission.

Notes are left out on read, with an info.

**`.exp` is not a native file.** It is a project export: gzip of a Java-serialised file list. `readStsProject(bytes)` (`native/project.ts`) reads it to the project's files and its `.sts`. It decompresses with the platform's `DecompressionStream`, reads the stream by its tags, and deserialises no class. A truncated export is an error, not a partial project.

**Unverified against STS-Tool.** Whether the tool may be run at all is the owner's open question (#160 D-R2, the EULA). The tutorial files round-trip through the reader and writer, but nothing has re-opened what the writer writes.

## The analyses and the derived requirements

They are #161's (`engines/sts/analysis/`): well-formedness, security (authorisation conflicts and the business-policy conflicts of S1 Def. 8, over variants), threat propagation (S2, S3 App. C), and the derived requirements. Each returns #162's findings. The stress script runs them on every seed and tutorial, and compares `runStsAnalyses` with #161's expectations.

## The oracle (#160 D1)

D1 point 3: the papers' printed results, and the three tutorial reports' tables. STS-Tool 2.2.4 and its bundled DLV come under a EULA that forbids reverse engineering, derivative works, and disclosing benchmark results without UniTN's written permission (#160 D-R2). Until the owner rules, nothing is run or read from the binary, and `--oracle` reports so. The tutorial projects aren't committed either, because they carry no licence (#160 D-R8). The stress script fetches them, pinned by sha256.

## What fit as it was

- New kinds and links, with shapes and rules: an extension in the model's `"metamodel"` block (#106, #110). The cross-actor links (delegation, transmission) needed only `sameActor: false`.
- Properties on links (#107), with link lines; refLists of an extension's kinds (#132).
- The native-file contract (#143, #144): `readXmi`, `writeXmi`, `canonicalXml`, `describeNativeRoundTrips`.
- An analysis engine (#107) on the IR (#125), registered as GRL, Tropos4AS and CGM are.

## Where the framework had to grow (#162)

No engine names in the core packages. The gate (`grep -rniE '\bsts\b|sts-?ml|secure.?tropos|sectro|authori[sz]ation'` over dialect, goal-language, goal-tree, lib's pool and `engines/analysis.ts`) finds nothing.

- **A1, link lines with an actor at an end** (`link actor "TAS" {…}`), for ownership, authorisations, role duties and threats to actors.
- **A2, `enumSet`**: a set of options, for the authorisation's operations.
- **A3, views** of one model, by kind.
- **A4, findings**: an analysis's list of what it found, with kind, severity, message, elements and links, listed and badged in the workbench.

## Still open

- **The EULA** (#160 D-R2): no STS-Tool or DLV oracle, and the writer is unverified against the tool.
- **The tutorial projects' licence** (#160 D-R8): fetched, not committed.
- **Contributions and threatened relationships in `.sts`**: their format is not in any published file.
- **Secure Tropos** (#160 D-R1): a dialect of its own, later.
- **An availability need without a level** (ATM's AVAIA): `availability` is a percentage, so the seed drops it.

## Examples

- `examples/sts/travel-planning/`: S5 §2, Figs. 1, 10–12 and 16 (Table 1, Figs. 17–19 printed).
- `examples/sts/stay-permit/`: S3's running example, Figs. 9, 14, 16, 18 and 20 (Table 2, Figs. 23–26 printed).
- `examples/sts/atm/`: S2's Fig. 1 (Fig. 5 printed).

Each README maps its figures element by element and lists every reading. The orchestrator provisionally accepted all three as equivalent to their figures; the owner confirms (#160). The tutorial projects are the stress script's (`scripts/sts-stress/README.md`).
