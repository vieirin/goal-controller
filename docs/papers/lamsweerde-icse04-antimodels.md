# Elaborating Security Requirements by Construction of Intentional Anti-Models

Axel van Lamsweerde, Département d'Ingénierie Informatique, Université catholique de Louvain, B-1348 Louvain-la-Neuve (Belgium). avl@info.ucl.ac.be

Proc. ICSE'04: 26th International Conference on Software Engineering, Edinburgh, ACM-IEEE, May 2004, pp. 148-157. DOI: 10.1109/ICSE.2004.1317437

Source PDF used for this transcription: https://webperso.info.ucl.ac.be/~avl/files/avl-Icse04-AntiGoals.pdf (author's own page, free access). Cached locally at `.cache/kaos/antimodels.pdf` / `.cache/kaos/antimodels.txt` (not committed).

© ACM/IEEE 2004, transcribed here for reference (fair-use excerpt/full-text working copy for internal oracle use, not redistribution).

Pagination below refers to the published page range 148–157; section numbers are the paper's own (there is no abstract/intro page-break marked in the extracted text, so page numbers are omitted except where noted by the PDF's own footer "Proc. ICSE'04 ... 148-157").

---

## Abstract

Caring for security at requirements engineering time is a message that has finally received some attention recently. However, it is not yet very clear how to achieve this systematically through the various stages of the requirements engineering process.

The paper presents a constructive approach to the modeling, specification and analysis of application-specific security requirements. The method is based on a goal-oriented framework for generating and resolving obstacles to goal satisfaction. The extended framework addresses malicious obstacles (called anti-goals) set up by attackers to threaten security goals. Threat trees are built systematically through anti-goal refinement until leaf nodes are derived that are either software vulnerabilities observable by the attacker or anti-requirements implementable by this attacker. New security requirements are then obtained as countermeasures by application of threat resolution operators to the specification of the anti-requirements and vulnerabilities revealed by the analysis. The paper also introduces formal epistemic specification constructs and patterns that may be used to support a formal derivation and analysis process. The method is illustrated on a web-based banking system for which subtle attacks have been reported recently.

## 1. Introduction

(Motivation only — crypto layer / security protocol layer / system layer / application layer distinction; this paper focuses on the application layer exclusively.)

Meta-requirements for a security RE technique:
- **Early deployment**: applicable as early as possible, to declarative assertions from stakeholder interviews/documents (not just later state-machine models).
- **Incrementality**: support intertwining of model building and analysis; reasoning about partial models.
- **Reasoning about alternatives**: represent and assess alternative options so a "best" route to security can be selected.
- **High assurance**: allow formal analysis when/where needed for compelling evidence of security assurance.
- **Security-by-construction**: avoid the endless cycle of defect fixes generating new defects; guarantee a satisfactory level of security by construction.
- **Separation of concerns**: keep security requirements separate from other requirement types to allow interaction analysis.

General idea: build two models iteratively and concurrently:
- a **model of the system-to-be** covering both software and environment, inter-relating goals, agents, objects, operations, requirements and assumptions;
- an **anti-model**, derived from the model, exhibiting how specifications of model elements could be maliciously threatened, why, and by whom.

Security requirements are elaborated systematically by iterating:
(a) instantiate specification patterns associated with property classes such as confidentiality, privacy, integrity, availability, authentication or non-repudiation;
(b) derive anti-model specifications threatening such specifications;
(c) derive alternative countermeasures to such threats and define new requirements by selection of alternatives that best meet other quality requirements from the model.

The method builds on the authors' earlier goal-oriented framework for generating/resolving obstacles to requirements achievement ([21, 22] in the paper's reference list — van Lamsweerde "Requirements Engineering in the Year 00", and van Lamsweerde & Letier "Handling Obstacles in Goal-Oriented RE", IEEE TSE 2000). The extension to malicious obstacles lets the obstacle refinement process be guided by the attacker's own goals and by the goal of deriving observable vulnerabilities and implementable threats, plus security-specific resolution operators.

Paper structure: §2 background on goal-oriented RE; §3 security specification patterns + epistemic extensions to the real-time temporal logic; §4 extending obstacle generation/resolution to malicious obstacles set up by attackers; §5 generating countermeasures; §6 case study (web-based banking security requirements, including a formal generation of a critical episode from a real reported attack); §7 related work; §8 conclusion.

## 2. Background

A **goal** is a prescriptive statement of intent about some system whose satisfaction in general requires the cooperation of some of the agents forming that system. **Agents** are active components (humans, devices, legacy software, software-to-be) that play some role towards goal satisfaction; some agents define the software, others the environment. Goals may be **functional** (services to be provided) or **non-functional** (quality of service). Unlike goals, **domain properties** are descriptive statements about the environment (physical laws, organizational norms/policies, etc.).

Goals are organized in **AND/OR refinement-abstraction hierarchies**: higher-level goals are strategic, coarse-grained, multi-agent; lower-level goals are technical, fine-grained, fewer agents. **AND-refinement** links relate a goal to a set of subgoals (the refinement), possibly conjoined with domain properties — satisfying all subgoals is a sufficient condition for satisfying the goal. **OR-refinement** links relate a goal to a set of alternative refinements — satisfying one of them is sufficient.

Goal refinement ends when every subgoal is realizable by some individual agent assigned to it, i.e., expressible in terms of conditions monitorable and controllable by the agent. A **requirement** is a terminal goal under responsibility of an agent in the software-to-be; an **expectation** is a terminal goal under responsibility of an agent in the environment (expectations cannot be enforced by the software-to-be).

Goals prescribe intended behaviors and can be formalized in a real-time temporal logic. Keywords **Achieve**, **Avoid**, **Maintain** are a lightweight alternative characterizing goals by the temporal behavior pattern they prescribe. **Softgoals** prescribe preferred behaviors and are used to select preferred alternatives in an AND/OR goal refinement graph.

Goals are operationalized into specifications of operations to achieve them. In an operation's specification, a distinction is made between domain pre-/postconditions (what any application of the operation means in the domain) and required pre-, trigger-, and postconditions (requirements on the operation necessary for achieving the underlying goals).

Goals refer to **objects**, incrementally derivable from their specification into a structural model (UML class diagrams). Objects have states defined by attributes and links to other objects; they are **passive** (entities, associations, events) or **active** (agents). Agents are related via their interface made of object attributes they monitor/control respectively.

**Obstacles** (first introduced in [33], C. Potts, "Using Schematic Scenarios to Understand User Needs", DIS'95) are a means for identifying goal violation scenarios. Declaratively: an obstacle to some goal is a condition whose satisfaction may prevent the goal from being achieved. An obstacle O is said to **obstruct** a goal G in some domain characterized by a set of domain properties Dom iff:

```
{O, Dom} |= ¬ G             obstruction
Dom |≠ ¬ O                  domain consistency
```

Obstacle analysis takes a pessimistic view at the goals, requirements, expectations being elaborated: identify as many ways of obstructing them as possible, then resolve each obstruction when likely and critical, producing more complete goals (refined further if necessary).

Specification patterns may be formalized in a first-order, real-time linear temporal logic augmented with **epistemic constructs** for security-related predicates.

In particular, the epistemic operator **KnowsV**ag is defined on state variables as follows:

```
KnowsV ag (v) ≡ ∃x : Knows ag (x = v)     ("knows value")
Knows ag (P)  ≡ Belief ag (P) ∧ P          ("knows property")
```

where the operational semantics of the epistemic operator **Belief**ag(P) is "P is among the properties stored in the local memory of agent ag". Domain-specific axioms must make precise under which conditions property P does appear and disappear in the agent's memory. An agent thus knows a property if that property is found in its local memory and it is indeed the case that the property holds.

Temporal logic notations used in the paper:
- `P ⇒ Q` means `□ (P → Q)` where `□` ("o" rendered by pdftotext, actually the box/always operator) means "in every future state" and `→` denotes logical implication. (Note: the paper's PDF text-extraction renders the "always" operator as a lowercase "o"; the true glyph is □, and the "next" operator is also printed as "o" for ○ — see UNREADABLE note below.)
- `○` ("o") means "in the next state".
- `◊ ≤d` means "some time in the future within d time units".

UNREADABLE: the PDF-to-text extraction collapses the temporal operators □ (always) and ○ (next) to the same ASCII character "o" in running text (e.g. "o ( P → Q)", "o" alone for next-state, "o Integrity(ob.Info)"). The distinction between □ and ○ could not be recovered character-by-character from the extracted text; where both appear in the same formula (Integrity pattern below), the first "o" preceding "(ob.Info ≠ v)" is almost certainly ○ (next state) and the one before "Integrity(ob.Info)" is almost certainly □ (always), per standard KAOS usage, but this is an inference, not a direct reading of the glyph.

For the Confidentiality goal pattern:

```
Goal Avoid [SensitiveInfoKnownByUnauthorizedAgent]
 FormalSpec ∀ ag: Agent, ob: Object
       ¬ Authorized (ag, ob.Info) ⇒ ¬ KnowsVag (ob.Info)
```

The `Authorized` predicate is generic and must be instantiated through an application-specific domain definition. For web-based banking, instantiation `Object/Account` while searching the object model for sensitive information yields:

```
∀ ag: Agent, acc: Account
Authorized (ag, acc) ≡
  Owner (ag, acc) ∨ Proxy (ag, acc) ∨ Manager (ag, acc)
```

Sensitive information about accounts includes the pair of objects (Acc#, PIN), defined in the object model as `partOf` the aggregation Account and interrelated through the association `Matching`.

Instantiating the Confidentiality pattern to this sensitive information yields the candidate confidentiality goal:

```
Goal Avoid [AccountNumber&PinKnownByUnauthorized]
 FormalSpec ∀ p: Person, acc: Account
    ¬ (Owner (p, acc) ∨ Proxy (p, acc) ∨ Manager (p, acc))
       ⇒ ¬ [ KnowsVp (acc.Acc#) ∧ KnowsVp (acc.PIN) ]
```

The same principle instantiates patterns for Privacy, Integrity and Availability goals:

```
Goal Maintain [PrivateInfoKnownOnlyIfAuthorizedByOwner]
 FormalSpec ∀ ag, ag': Agent, ob: Object
    KnowsV ag (ob.Info) ∧ OwnedBy (ob.Info, ag') ∧ ag ≠ ag'
       ⇒ AuthorizedBy (ag, ob.Info, ag')

Goal Maintain [ObjectInfoChangeOnlyIfCorrectAndAuthorized]
 FormalSpec ∀ ag: Agent, ob: Object, v : Value
    ob.Info = v ∧ ○ (ob.Info ≠ v) ∧ UnderControl (ob.Info, ag)
       ⇒ Authorized (ag, ob.Info) ∧ □ Integrity (ob.Info)

Goal Achieve [ObjectInfoUsableWhenNeededAndAuthorized]
 FormalSpec ∀ ag: Agent, ob: Object, v : Value
    Needs (ag, ob.Info) ∧ Authorized (ag, ob.Info)
       ⇒ ◊ ≤d Using (ag, ob.Info)
```

Application-specific security goal candidates are obtained from such patterns by (a) instantiating meta-classes Object, Agent and generic attributes (Info) to application-specific sensitive classes/attributes/associations in the object model, and (b) specializing predicates such as Authorized, UnderControl, Integrity or Using through application-specific definitions.

Sensitive objects found in the object model may be passive (entities, associations, events) or active (agents, e.g., programs).

## 3. Specification Patterns for Security Goals

Specialization of the **SecurityGoal** meta-class: **Confidentiality**, **Integrity**, **Availability**, **Privacy**, **Authentication** and **Non-repudiation** goal subclasses. Patterns refer to meta-classes from the language meta-model (Object, Agent). For each subclass of SecurityGoal, instantiating the corresponding pattern to "sensitive" attributes/associations from the object model yields candidate application-specific security goals (as shown above).

## 4. Building Intentional Threat Models

Obstacles may obstruct safety or security goals; obstacle refinement trees correspond to fault trees (safety) and threat trees (security). Two significant differences from standard fault/threat trees:
- Obstacle trees are **goal-anchored**: the root is a goal negation, so the analyst knows exactly where to start.
- Obstacles can be formally generated by regressing goal negations through domain properties and other goal assertions, or via formal obstruction/refinement patterns.

Standard obstacle analysis is too limited for malicious obstacles because:
- The goals underlying malicious obstacles are not captured — can't drive obstacle refinement from them.
- There is no modeling of attacker agents and their capabilities (operations they perform, objects they monitor/control) — can't reason about them.
- Software vulnerabilities are not explicit in standard models — can't reason about or derive them.
- The obstacle likelihood/criticality assessment may differ wildly once attacker agents and their goals (e.g., terrorists wanting major damage) are made explicit, versus a "neutral" obstacle analysis.

Richer models must capture attackers, their goals and capabilities, the vulnerabilities they can monitor/control, and attacks satisfying their goals based on capabilities and system vulnerabilities.

**Anti-models**: models of attackers' own goals (anti-goals), including malicious obstacles to security goals. Anti-goals are distinguished from the goals the system-under-consideration should satisfy. Anti-models should lead to generation of more subtle threats and derivation of more robust security requirements as anticipated countermeasures.

### Table 1: Anti-Model Building Method

A procedure for building intentional anti-models systematically (dual version of the goal-oriented requirements elaboration method); steps are ordered by data dependencies and generally intertwined:

1. Get initial anti-goals by negating relevant Confidentiality, Privacy, Integrity and Availability goal specification patterns instantiated to sensitive objects from the object model.
2. For each such anti-goal, elicit potential attacker agents that might own the anti-goal, from questions such as "WHO can benefit from this anti-goal?" (Application-specific specializations of known attacker taxonomies may help answering such questions.)
3. For each anti-goal and corresponding attacker class(es) identified, elicit the attacker's higher-level anti-goals from questions such as "WHY would instances of this attacker class want to achieve this anti-goal?". Such questions may be asked recursively to elicit more and more abstract anti-goals yielding threat rationales together with other potential threats from alternative refinements of those higher-level anti-goals.
4. Elaborate the anti-goal AND/OR graph by AND-refining/abstracting anti-goals along alternative branches, with the aim of deriving terminal anti-goals that are realizable either by the identified attacker agents or by attackee software agents. The former are anti-requirements assigned to the attacker whereas the latter are vulnerabilities assigned to the attackee. (This step may be performed informally by asking HOW/WHY questions, or formally by regression through the goal model and domain theory, or by use of refinement patterns and obstruction patterns.)
5. Derive the object and agent anti-models from anti-goal specifications. The boundary between the anti-machine (under the attacker's control) and the anti-environment (which includes the software attackee) are thereby derived together with monitoring/control interfaces.
6. AND/OR-operationalize all anti-requirements in terms of potential capabilities of the corresponding attacker agent — the latter may include blind or intelligent searching, eavesdropping, deciphering, spoofing, cookie installation, etc.

In Step 4, an anti-goal is **realizable** by some agent if formulated in terms of conditions monitorable and controllable by the agent. The vulnerabilities derived by anti-goal refinement in Step 4 rightly fit the Common Criteria definition of vulnerability: "a condition of an agent that, in conjunction with a threat, can lead to security requirement violation" (ref [6], Common Criteria for Information Technology Security Evaluation, Aug. 1999).

The AND/OR refinement/abstraction process (Step 4) may be guided by:
- asking "HOW?" and "WHY?" questions about the anti-goals already found;
- regressing anti-goal specifications through domain properties to find anti-goal preconditions satisfiable in the domain — attacker exploits features of the domain;
- regressing anti-goal specifications through goal specifications from the primal model to find anti-goal preconditions satisfiable by the software — attacker exploits features of the software itself;
- applying formal refinement patterns — notably, the "milestone", "decomposition-by-case", "resolve lack of monitorability" and "resolve lack of controllability" patterns, and obstruction patterns.

### Fig. 1 — The milestone pattern

```
                 C ⇒ ◊ T

        C ⇒ ◊ M          M ⇒ ◊ T
```
(A parent anti-goal `C ⇒ ◊ T` AND-refines into two children `C ⇒ ◊ M` and `M ⇒ ◊ T` via an intermediate milestone M.)

### Fig. 2 — Milestone pattern application

Root anti-goal: **PaymentMediumKnownByUnauthorized**

AND-refines (3 children, bold-circled AND-node = provably complete refinement) into:
- **UnauthorizedKnowsWhichBank**
- **UnauthorizedKnowsAccountStructure**
- **AccountNumber&PinKnownByUnauthorized**

The milestone pattern applied to the web banking anti-goal `PaymentMediumKnownByUnauthorized` yields these three children (the last being the initial anti-goal elaborated further in Section 6).

The resulting anti-model relates attackers, their anti-goals, referenced objects and anti-goal operationalizations to the attackees, their goals, objects, operations and vulnerabilities.

When goals are formalized in the real-time temporal logic, the logical models of anti-goals are sets of attack scenarios. Bounded SAT solvers can then be used to generate such scenarios automatically.

## 5. Generating Countermeasures

Once intentional anti-models have been built, the next step is to consider alternative countermeasures to the vulnerabilities and anti-requirements found. A preferred countermeasure is selected based on (a) the severity and likelihood of the corresponding threat, and (b) non-functional goals identified in the primal goal model. The selected countermeasure yields a new security goal integrated in the primal model.

Alternative countermeasures may be produced systematically using operators similar to those for resolving obstacles:
- **Goal substitution**: develop an alternative refinement of the parent goal to prevent the original subgoal from being threatened by the anti-goal.
- **Agent substitution**: replace a vulnerable agent assigned to a threatened goal by a less vulnerable one for the threatening anti-goal.
- **Goal weakening**: weaken the specification of the goal being threatened so as to make it circumvent the threatening anti-goal.
- **Goal restoration**: introduce a new goal prescribing appropriate restoration measures in states where the goal has been threatened by the anti-goal.
- **Anti-goal mitigation**: tolerate the anti-goal but mitigate its effects.
- **Anti-goal prevention**: add a new goal requiring the anti-goal to be Avoided.

Security-specific operators extending the above list:
- **Protect vulnerability**: make the derived vulnerability condition unmonitorable by the attacker.
- **Defuse threat**: make the derived anti-requirement condition uncontrollable by the attacker.
- **Avoid vulnerability**: add a new goal requiring the software vulnerability condition to be Avoided.

Once alternative anti-goal resolutions have been produced, a preferred one is selected based on how critical the threatened goal is and on how well the resolution meets other non-functional goals (the NFR qualitative framework may support this selection).

The new security goal retained has to be AND/OR refined in turn until requirements/expectations are reached. A new model/anti-model building cycle may then be required.

For anti-goals that are not too severe, resolutions may be deferred from specification time to run time using anti-goal monitoring and intrusion detection technology.

## 6. Case Study: Web-Based Banking Services

Step 1 instantiates the confidentiality pattern `Avoid [SensitiveInfoKnownByUnauthorizedAgent]` into `Avoid [AccountNumber&PinKnownByUnauthorized]` (Section 3). The instantiated formal specification is negated, yielding:

```
AntiGoal Achieve [AccountNumber&PinKnownByUnauthorized]
  FormalSpec ◊ ∃ p: Person, acc: Account
     ¬ [ Owner (p, acc) ∨ Proxy (p, acc) ∨ Manager (p, acc) ]
      ∧ KnowsV p (acc.Acc#) ∧ KnowsVp (acc.PIN)
```

By asking WHO could benefit from the above anti-goal, Step 2 elicits potential attacker agent classes such as **Thief**, **Hacker**, **BankQualityAssuranceTeam**, etc.

Consider a **Thief** agent. Step 3 elicits a parent anti-goal:

```
Achieve [PaymentMediumKnownByThief]
```

and the grand-parent anti-goal:

```
Achieve [MoneyStolenFromBankAccounts]
```

(Lack of space prevents building the entire anti-goal/anti-object/anti-operation models for the Thief agent through Steps 4–6.) The milestone pattern instantiation of Fig. 2 produces two other child nodes of `Achieve[PaymentMediumKnownByThief]`:

```
Achieve [ThiefKnowsWhichBank]
Achieve [ThiefKnowsAccountStructure]
```

Focusing on refinements of the anti-goal `Achieve [AccountNumber&PinKnownByUnauthorized]` along one branch of the anti-goal AND/OR graph: asking "what are sufficient conditions in the domain for someone unauthorized to know both the number and PIN of an account simultaneously?", and using the symmetry of the association `Matching` between account numbers and PINs in the object model (multiplicity [1..1, 1..N]), two symmetrical domain properties are elicited:

```
∀ p: Person, acc: Account
 ¬ [ Owner (p, acc) ∨ Proxy (p, acc) ∨ Manager (p, acc) ]
 ∧ KnowsV p (acc.Acc#)
 ∧ (∃ x: PIN) (Found (p, x) ∧ Matching (x, acc.Acc#))
     ⇒ KnowsVp (acc.Acc#) ∧ KnowsVp (acc.PIN)
```

and

```
¬ [ Owner (p, acc) ∨ Proxy (p, acc) ∨ Manager (p, acc) ]
 ∧ KnowsV p (acc.PIN)
 ∧ (∃ y: Acc#) (Found (p, y) ∧ Matching (acc.PIN, y))
     ⇒ KnowsVp (acc.Acc#) ∧ KnowsVp (acc.PIN)
```

Formally regressing the anti-goal `Achieve [AccountNumber&PinKnownByUnauthorized]` through each of these domain properties gives two alternative preconditions (an OR-refinement into two alternative, symmetrical anti-subgoals):

```
AntiGoal Achieve [AccountKnown&MatchingPinFound]
  FormalSpec ◊ ∃ p: Person, acc: Account
     ¬ [ Owner (p, acc) ∨ Proxy (p, acc) ∨ Manager (p, acc) ]
        ∧ KnowsV p (acc.Acc#)
        ∧ (∃ x: PIN) [ Found (p, x) ∧ Matching (x, acc.Acc#) ]
```

and

```
AntiGoal Achieve [PinKnown&MatchingAccountFound]
  FormalSpec ◊ ∃ p: Person, acc: Account
     ¬ [ Owner (p, acc) ∨ Proxy (p, acc) ∨ Manager (p, acc) ]
        ∧ KnowsV p (acc.PIN)
        ∧ (∃ y: Acc#) [ Found (p, y) ∧ Matching (acc.PIN, y) ]
```

The refinement process continues until software vulnerabilities and anti-requirements realizable by the Thief agent are reached.

### Fig. 3 — Portion of an anti-goal model for web banking services

Tree structure (top to bottom, left to right as printed; `...` marks branches not detailed in the paper due to space):

- **MoneyStolenFromBankAccounts** (grand-parent anti-goal)
  - **AccountsAttacked**
  - **MoneyTakenFromAttackedAccounts**
    - `...`
  - **PaymentMediumKnownByThief** (parent anti-goal)
    - **ThiefKnowsWhichBank** → `...`
    - **ThiefKnowsAccountStructure** → `...`
    - **AccountNumber&PinKnownByThief** (= initial anti-goal, labeled "initial anti-goal" in the figure) — OR-refines into two alternatives (labeled "alternatives" in the figure):
      - **PinKnown&MatchingAccountNumberFound**
        - **PinKnown** → `...`
        - **MatchingAccountNumberFound**
          - **AccountNumberCheckedForPinMatch** → `...`
          - **CheckIteratedOnOtherAccountNumbersIfNoMatch**
          - **RepeatableAccountNumberCheckFromPin** (vulnerability, leaf)
      - **AccountNumberKnown&MatchingPinFound**
        - **AccountNumberKnown** → `...`
        - **MatchingPinFound** → `...`

(The figure's exact left/right placement of the two symmetric subtrees and some leaf labels are reconstructed from the running text below, since the PDF-to-text layout scrambles the box positions; the leaf labels and parent/child relations themselves are as printed.)

The derived anti-requirements assignable to the Thief agent are, in one alternative refinement:
```
PinCheckedForAccountNumberMatch,
CheckIteratedOnOtherPinsIfNoMatch
```
and, in the other alternative:
```
AccountNumberCheckedForPinMatch,
CheckIteratedOnOtherAccountNumbersIfNoMatch
```

Those anti-requirements are operationalizable using web technology (ref [36]: A. dos Santos, G. Vigna, R. Kemmerer, "Security Testing of the Online Banking Service of a Large International Bank", Proc. 1st Workshop on Security and Privacy in E-Commerce, Nov. 2000). The anti-requirement in the second alternative is more subtle and corresponds to a sophisticated, real attack reported in [36].

The corresponding vulnerabilities derived are:
```
RepeatablePinCheckFromAccountNumber
```
and
```
RepeatableAccountNumberCheckFromPin
```
respectively.

Once this anti-model has been built, the resolution operator `Avoid [Vulnerability]` is required given the criticality of the vulnerabilities. This produces two new, conjoined security goals:
```
Avoid [RepeatablePinCheckFromAccountNumber],
Avoid [RepeatableAccountNumberCheckFromPin]
```

The first new goal corresponds to the usual limitation of the number of PIN entries (e.g., to three attempts). The second new goal prevents exhaustive searching for account numbers matching some fixed PIN number. These goals must be refined in turn until requirements on the software and expectations on the environment are reached. A new anti-model building cycle may be undertaken for these new goals, if necessary.

## 7. Related Work

- Misuse cases complementing UML use cases (Alexander [1]; Sindre & Opdahl [40]) capture attacker features at RE time.
- Anti-requirements as requirements on the attacker to break existing requirements (Crook, Ince, Lin, Nuseibeh [10], "Security Requirements Engineering: When Anti-Requirements Hit the Fan", RE'02). Elaborated further via **abuse frames** defining the scope and boundary of anti-requirements (Lin, Nuseibeh, Ince, Jackson, Moffett [27]).
- Goal-based approaches for security: the NFR framework organizes known security properties as AND/OR goal graphs (Chung, Nixon, Yu, Mylopoulos [8]). Anton, Earp, Reese propose a privacy-goal taxonomy from 23 internet privacy policies in health-care industries [3].
- A catalogue of known threat tree patterns for documentation/reuse through instantiation: Moore, Ellison, Linger [30].
- Work closest in spirit: Liu, Yu, Mylopoulos [28] extend the i* agent-based RE framework to identify attackers, analyze vulnerabilities through agent dependency links and suggest countermeasures. Main difference: they start from agents involved in the system rather than goals being threatened; they identify **insider attackers only** (system stakeholders already identified in the primal model); malicious goals owned by such attackers are not modelled explicitly; no formal techniques for building threat models. Their approach's strength: propagation of vulnerabilities along agent dependency links.
- Dwyer, Avrunin, Corbett [14] built an extensive catalogue of formal specification patterns (temporal behaviors), not specific to security.
- Sheyner, Haines, Jha, Lippmann, Wing [39] use model checking to generate/analyze attack graphs: given a state-machine model N of the network under attack, a model A of the attacker's capabilities, and a desired security property S, their tools produce all possible counterexample scenarios when trying to verify `N, A ⊨ S`. The present work is an "upstream" complement: applicable sooner in the process, pointing out security problems earlier at the requirements level by deriving threats through deductive inference from partial, declarative goal/anti-goal models — as opposed to operational state-machine models that must be completely built up first.

## 8. Conclusion

Focus: security engineering at the application layer exclusively; compared with crypto, protocol, system/language layers, the application layer has received much less attention. Prerequisite for security assurance at this layer: application-specific security requirements must be explicit, precise, adequate, non-conflicting, and complete.

Method: incremental building and specification of two concurrent models — an intentional model of the system-to-be, and an intentional anti-model yielding vulnerabilities and capabilities required for achieving the anti-goals threatening security goals from the original model. Threat trees are derived systematically through anti-goal refinement until leaf nodes are reached that are either attackee vulnerabilities observable by the attacker or anti-requirements implementable by this attacker. The original model is enriched with new security requirements derived as countermeasures to the anti-model.

Extensions to the KAOS framework for goal-oriented RE:
- extends the specification language with epistemic constructs for reasoning about the attacker's knowledge;
- provides specification patterns for formal elicitation of candidate security requirements to start the analysis;
- introduces a duality principle for richer modeling of threats; system goals, requirements, expectations about the environment and software services are transposed to malicious obstacles to security requirements, implementable anti-requirements, software vulnerabilities and attacker capabilities, respectively;
- supports the obstacle likelihood/severity assessment phase by linking malicious obstacles to attackers and their malicious goals.

Validation: the original goal-oriented model building method has been validated extensively (over 25 industrial projects in a wide variety of domains); its transposition to anti-model building has been limited to **four case studies** so far:
1. the web-based banking case used for illustration in this paper;
2. a popular smartcard-based payment system used in Belgium;
3. a web-based CD order tracking system;
4. an e-commerce system relying on an independent payment processing agent.

For case 3 (CD order tracking), a similar derivation from a confidentiality goal about order information derived vulnerabilities found in reported attacks on a well-known CD sales company, namely: (a) confidential order information was obtainable just by submitting guessable order numbers, and (b) order numbers were appearing on the page URL displayed by the order tracking service.

For case 4 (e-commerce with independent payment processing), the anti-model revealed a man-in-the-middle attack making malicious use of the system's services; obtained by anti-goal regression through the system's goals (in addition to domain properties, see Section 4). In this case study, the initial anti-goal was **not** a negated instantiation of a security goal pattern but just a negated functional goal ("the item is sent but not paid"). This case study also suggested the need for distinguishing vulnerabilities that are more critical in anti-goal achievement than others.

Open issues:
- When does the cycle "requirement/anti-requirement/countermeasure" terminate?
- Can we build richer catalogues of threat patterns and corresponding "best" countermeasure patterns?
- To what extent do boundary conditions for conflict among multiple goals play the role of covert channels exploitable by attackers to satisfy their anti-goals?
- How do we incorporate trust models in this framework and model trustworthy agents?
- Can we incorporate probabilistic frameworks to reason about partial satisfaction of goals/anti-goals and determine the likelihood of anti-goal occurrences?

Acknowledgement: work partially supported by the Regional Government of Wallonia (MILOS project, RW Conv. 114856). Thanks to Bashar Nuseibeh, Renaud De Landtsheer, David Janssens, Emmanuel Letier; special thanks to Renaud and David for feedback from their experimentation of the method on the Tower Records and Paypal case studies, respectively.

## References (as cited in the body above)

- [1] I. Alexander, "Misuse Cases: Use Cases with Hostile Intent", IEEE Software, Jan/Feb 2003, 58-66.
- [3] A. Anton, J. Earp and A. Reese, "Analyzing Website Privacy Requirements Using a Privacy Goal Taxonomy", Proc. RE'02, Essen, Sept. 2002, 23-31.
- [6] Common Criteria for Information Technology Security Evaluation, Aug. 1999, http://www.commoncriteria.org/.
- [8] L. Chung, B. Nixon, E. Yu and J. Mylopoulos, Non-functional requirements in software engineering. Kluwer Academic, Boston, 2000.
- [10] R. Crook, D. Ince, L. Lin and B. Nuseibeh, "Security Requirements Engineering: When Anti-Requirements Hit the Fan", Proc. RE'02, Essen, Sept. 2002, 203-205.
- [11] A. Dardenne, A. van Lamsweerde and S. Fickas, "Goal-Directed Requirements Acquisition", Science of Computer Programming, Vol. 20, 1993, 3-50.
- [12] R. Darimont and A. van Lamsweerde, "Formal Refinement Patterns for Goal-Driven Requirements Elaboration", Proc. FSE'4, San Francisco, Oct. 1996, 179-190.
- [14] M.B. Dwyer, G.S. Avrunin and J.C. Corbett, "Patterns in Property Specifications for Finite-State Verification", Proc. ICSE'99, May 1999.
- [20] A. van Lamsweerde, R. Darimont, E. Letier, "Managing Conflicts in Goal-Driven Requirements Engineering", IEEE TSE, Nov. 1998, 908-926.
- [21] A. van Lamsweerde, "Requirements Engineering in the Year 00: A Research Perspective", Keynote, Proc. ICSE'2000.
- [22] A. van Lamsweerde and E. Letier, "Handling Obstacles in Goal-Oriented Requirements Engineering", IEEE TSE, Special Issue on Exception Handling, Vol. 26 No. 10, Oct. 2000, 978-1005.
- [23] A. van Lamsweerde, "Goal-Oriented Requirements Engineering: A Guided Tour", Invited Minitutorial, Proc. RE'01, Toronto, Aug. 2001, 249-263.
- [24] E. Letier and A. van Lamsweerde, "Agent-Based Tactics for Goal-Oriented Requirements Elaboration", Proc. ICSE'02, Orlando, May 2002.
- [25] E. Letier and A. van Lamsweerde, "Deriving Operational Software Specifications from System Goals", Proc. FSE'10, Charleston, Nov. 2002.
- [27] L. Lin, B. Nuseibeh, D. Ince, M. Jackson and J. Moffett, "Introducing Abuse Frames for Analyzing Security Requirements", Internal Report, Open University, 2003.
- [28] L. Liu, E. Yu and J. Mylopoulos, "Security and Privacy Requirements Analysis within a Social Setting", Proc. RE'03, Sept. 2003, 151-161.
- [30] A.P. Moore, R.J. Ellison and R.C. Linger, "Attack Modeling for Information Security and Survivability", Technical Note CMU/SEI-2001-TN-001, March 2001.
- [36] A. dos Santos, G. Vigna, and R. Kemmerer, "Security Testing of the Online Banking Service of a Large International Bank", Proc. 1st Workshop on Security and Privacy in E-Commerce, Nov. 2000.
- [39] O. Sheyner, J. Haines, S. Jha, R. Lippmann and J. Wing, "Automated Generation and Analysis of Attack Graphs", Proc. IEEE Symp. Security and Privacy, Oakland, May 2002.
- [40] G. Sindre and A.L. Opdahl, "Eliciting Security Requirements by Misuse Cases", Proc. TOOLS Pacific'2000, 120-131.

(Remaining references [2,4,5,7,9,13,15-19,26,29,31-35,37,38,41,42] are general background citations not quoted in the body text; omitted here as not load-bearing for the oracle — see the cached `.txt` for the complete list if needed.)
