# A KAOS Tutorial (Respect-IT, 2007)

**Citation:** Respect-IT sa, *A KAOS Tutorial*, Version 1.0, Oct. 18, 2007. © Respect-IT, 2007.
**Source URL used:** https://csis.pace.edu/~marchese/CS775/Papers/KaosTutorial.pdf (mirror of the
original `objectiver.com/fileadmin/download/documents/KaosTutorial.pdf`, which no longer resolves).
PDF cached at `.cache/kaos/KaosTutorial.pdf` (not committed), text extracted with
`docker run --rm -v .cache/kaos:/w -w /w minidocks/poppler pdftotext -layout KaosTutorial.pdf KaosTutorial.txt`.
**Licence:** no licence stated in the document; © Respect-IT. Transcribed here for reference only
(per the issue's "no licence; re-keyed" note on #195/#210), not for redistribution.

## What this file is and is not

The tutorial's four KAOS models (goal, responsibility, object, operation) and the obstacle
analysis are illustrated with ~36 Objectiver screenshots (Figures 1-36), captured as embedded
**raster/vector images**, not as a text or table layer. `pdftotext -layout` extracts the surrounding
prose and figure *captions* faithfully (verified: no vector text run for any figure body), but
**none of the figures' internal content — node labels, attribute names/types, link labels such as
`Multiplicity`, `Role`, `DomPre`, `DomPost`, `Delay`, `Frequency`, `Load` — exists as extractable
text anywhere in the PDF** (confirmed by `grep -i` over the full extracted text: zero hits for
`DomPre`, `DomPost`, `Multiplicity`, `Frequency`, `Delay`, `Load`, `Role`). Per the task's
instruction not to render pages to images or OCR, every figure's internal content below is marked
**UNREADABLE**. Only the prose that describes what a figure shows (the tutorial narrates most
figures in the surrounding text) is transcribed verbatim.

This means: the Objectiver UI attribute vocabulary (`Multiplicity`/`Role` on associations,
`Frequency` on events, `Delay` on cause links, `Load` on agents, `DomPre`/`DomPost` on operations)
that issues #194/#210 want as an oracle is **not available from this document as extractable
text**. It is asserted in `#194`'s issue body from the papers/zip (FSE'02, ICSE'02, KAOS2LTSA),
not from this tutorial. The tutorial's actual contribution is the **structure** of the
responsibility-operationalisation-performance triangle and the categories of concepts (entity /
agent / association / event), which the prose below does state in words.

## Table of contents (for section/page numbers)

1. Introduction (p.5)
2. Key ideas underlying KAOS (p.6)
3. The Elevator case study (p.11)
   - 3.1 Problem statement (p.11)
   - 3.2 Goal model (p.11): 3.2.1 Requirements patterns (p.11), 3.2.2 Application to the elevator
     problem (p.13)
   - 3.3 Responsibility model (p.23)
   - 3.4 Object model (p.26)
   - 3.5 Operation model (p.30)
   - 3.6 Dealing with obstacles (p.34)
   - 3.7 Requirements document generation (p.37)
4. Discussion (p.41)
5. Conclusion (p.44)
6. Methodology summary (p.45): 6.1 KAOS meta-model, 6.2 KAOS glossary

## 3.3 Responsibility model (p.23-25)

> The responsibility model contains all the responsibility diagrams. A responsibility diagram
> describes for each agent, the requirements and expectations that he's responsible for, or that
> have been assigned to him.
>
> To build a responsibility diagram, the analyst reviews the different requirements and
> expectations in the goal model and assigns an agent to each of them. For instance the diagram
> of Figure 18 ("System protected against fire") has been updated as shown Figure 20.
> - the Elevator controller is responsible for having the doors locked open when a fire alarm is
>   set and for stopping all moving elevators as soon as they reach any floor
> - the Elevator company that will install the elevator system is responsible for providing
>   fireproof equipments (cage and equipment).
>
> After all requirements and expectations are assigned a responsible agent, a diagram is
> generated for each agent, listing all requirements and expectations that he's been assigned.
> Figure 21 and Figure 22 show such diagrams.
>
> By definition, the responsibility model is derived from the goal model. Objectiver, the tool
> supporting KAOS fully automates the production of all responsibility diagrams.

**Figure 20. "System protected against fire (with responsibilities)"** — UNREADABLE (image). Per
the prose: shows the "System protected against fire" goal diagram (from Fig. 18) annotated with
two responsibility assignments: Elevator controller → {doors locked open on fire alarm, stop all
moving elevators at nearest floor}; Elevator company → {provide fireproof cage, provide fireproof
equipment}.

**Figure 21. "Responsibilities of the elevator company"** — UNREADABLE (image). Per the prose: one
diagram per agent, listing all requirements/expectations assigned to that agent (here: the
elevator company).

**Figure 22. "Responsibilities of the Elevator Controller"** — UNREADABLE (image). Same form as
Fig. 21, for the Elevator Controller agent.

## 3.4 Object model (p.26-29)

> The object model is used to define and document the concepts of the application domain that are
> relevant with respect to the known requirements and to provide static constraints on the
> operational system that will satisfy the requirements. Part of the object model, you'll find
> objects pertaining to the stakeholders's domain and other objects introduced on purpose to
> express requirements or constraints on the operational system. Whatever type of the object, the
> stakeholders should understand what it means and why it was created in the model.
>
> Three types of objects may coexist in the object model:
> - **entities**: they represent independent, passive objects. For instance, elevator doors,
>   buttons, etc... 'Independent' means that their descriptions needn't refer to other objects of
>   the model. They may have attributes whose values define a set of states the entity can
>   transition to. They are 'passive' means they can't perform operations.
> - **agents**: represent independent, active objects. For instance, elevator company, passenger,
>   and elevator controller are agents. They are active meaning they can perform operations.
>   Operations usually imply state transitions on entities (for instance, the "CloseDoor" operation
>   implies the following state transition on the entity "Door": status attribute changed from
>   "Open" to "Close").
> - **associations**: are dependent, passive objects. 'Dependent' because their descriptions refer
>   to other objects. For instance, the At association links a Cage to a Floor. An instance of
>   that association (say between Cage 'c' and Floor 'f') would hold if cage 'c' is currently
>   located on floor 'f'. They can have attributes whose values define the set of states the entity
>   can transition to. They are passive so they can't perform operations. But agents can make
>   association instances change state by performing operations. For instance, the operation
>   "LeaveFloor" implies the following transition: `At(c,f) --> not At(c,f)`.
>
> Object identification is driven by the goal definition process. Most goals's short and long
> definitions refer to domain objects worth being modelled and documented. All modelled objects
> shall have their own entries in the glossary section of the requirements document. During review
> of the object model, stakeholders will formally agree on a common vocabulary.
>
> When new objects are identified while browsing through the goal model, the analyst shall define
> them in an object diagram and relate them to the existing concepts. For instance, in Figure 23,
> we have defined "Alarm bell" as being a component of the "Elevator System".
>
> Another way to identify new objects consists in looking at the requirements and discover the
> system components they are necessary for satisfying the requirements. Objects may be
> represented in goal diagrams; the concerns relationship is used to link a requirement to the
> objects that are needed for it to be satisfied (see an example on Figure 24). Identifying those
> objects shall further restrict the space of solutions that can be proposed by the future system
> provider.
>
> Figure 24 shows the components of an Elevator system. The figure should be read as follows: The
> Elevator System is made of the following components:
> - one or several cage
> - at least 2 floors
> - one alarm bell, which is (a specialization of) an Alarm device
> - one elevator controller, located in a control room
> - one power supply.
>
> A cage is equipped as shown on Figure 26. Floors are all equipped as shown on Figure 27.
>
> The KAOS object model is compliant with UML class diagrams in that KAOS entities correspond to
> UML classes; and KAOS associations correspond to UML binary association links or n-ary
> association classes. Inheritance is available to all types of objects (including associations).
> Objects can be qualified with attributes.

**Figure 23. "Alarm bell"** — UNREADABLE (image). Per the prose: "Alarm bell" entity shown as a
component of the "Elevator System" entity (composition/part-of link).

**Figure 24. "Concerns relationship: 'Alarm bell'"** — UNREADABLE (image). Per the prose: a goal
diagram with a `concerns` link from a requirement to the Alarm bell object, and the Elevator
System's composition structure: Elevator System made of {cage (1..*), floor (2..*), alarm bell
(1, specialises Alarm device), elevator controller (1, located in a control room), power supply
(1)}. Exact `Multiplicity`/`Role` attribute values as shown in Objectiver: UNREADABLE (image).

**Figure 25. "Elevator System"** — UNREADABLE (image). Not separately narrated beyond the Fig. 24
description above (same composition structure, own diagram).

**Figure 26. Object "Cage"** — UNREADABLE (image). Referenced only as "A cage is equipped as shown
on Figure 26" — no further textual description of its sub-components.

**Figure 27. Object "Floor"** — UNREADABLE (image). Referenced only as "Floors are all equipped as
shown on Figure 27" — no further textual description.

## 3.5 Operation model (p.30-33)

> The KAOS operation model describes all the behaviors that agents need to fulfill their
> requirements. Behaviors are expressed in terms of operations performed by agents. Operations
> work on objects (defined in the object model): they can create objects, trigger object state
> transitions and activate other operations (by sending an event).
>
> Where do operations come from? There are two sources for identifying them:
> - Operations can directly be expressed by stakeholders during the interviews. Stakeholders in
>   charge of processes in the current system typically describe processes rather than goals
>   during interviews. The analyst will then have to ask specific questions in order to identify
>   the reasons behind the existing processes and hence unveil the goals that justify these
>   processes.
> - Operations can be identified by looking at all the existing requirements. They explain how
>   requirements have to be realized.
>
> A requirement can be operationalized by some object(s), by some agent behavior(s) or a
> combination of both:
> - Requirements that describe static properties on the system are operationalized by objects. For
>   instance, the requirement "Elevator equipped with floor doors" will be operationalized by an
>   object: "Floor door".
> - Requirements that describe dynamic system properties are operationalized by operations.
> - Requirements that describe properties with static and dynamic aspects are operationalized with
>   objects and operations. For instance the expectation "Stop button used" will be
>   operationalized with an operation "Push button" and the "Button" entity.
>
> Figure 28 displays a process. Operations are represented as ovals. Concerned objects are
> connected to the operations by means of Input and Output links. Events are represented as those
> traffic signs that are used to indicate directions. Events can be external or produced by
> operations (they are them made an output of the operation). They may start (cause) or stop
> operations. For instance in the diagram, the "Refresh" event is produced by the "Reschedule"
> operation and it starts execution of operation "Execute schedule".
>
> The diagram should be read as follows: When a passenger pushes a button of the elevator system,
> the system refreshes the list of instructions (Reschedule) the elevator controller has to
> execute. The new schedule will be immediately in use by the elevator controller. To execute a
> schedule, the elevator controller needs to know the schedule and the latest elevator system
> state. The elevator system state is updated thanks to another specific event (Elevator state
> change).
>
> Figure 29 shows a partial classification of the events that are used in the process. Events have
> been classified in three categories:
> - passenger commands: translate passengers' operations like pushing a button;
> - elevator state change events: result from system observation: floor detection, sensors, etc.
> - elevator system command events: issued by the elevator controller to operate the elevator
>   system.
>
> A possible scenario for this process can be the following one: let's suppose the elevator is
> heading down to the ground floor and is currently on floor 35. On floor 15, a passenger calls the
> elevator to go down. Execution of the process can be traced as follows: the passenger command
> (event) "Floor call button pushed" is detected and triggers rescheduling by inserting two
> instructions in front of the schedule: one to turn the "Floor call button light" on (the one that
> was actually pushed by the passenger); second instruction is to have the elevator stop on floor
> 15. The new schedule then becomes effective and is taken into account by the elevator controller,
> which immediately sends an event to turn the light on ("Button light on command"). It will then
> wait to receive the event "Arrival on floor" for floor 15 before issuing a "Stop cage command"
> event.
>
> Notice how a new concept was identified while we were defining this process: "Schedule". This
> entity represents the sequence of commands the elevator controller has to execute. New concepts
> typically appear in processes while data and control flows are analysed.
>
> A process diagram must fulfill the following completeness criteria:
>
> **Completeness criterion 3**: To be complete, a process diagram must specify (i) the agents who
> perform the operations (ii) the input and output data for each operation.
>
> **Completeness criterion 4**: To be complete, a process diagram must specify when operations are
> to be executed.
>
> Operations can be triggered explicitly by an event (control flow) like the "Passenger command
> issued" event in Figure 28. If no event is specified, the operation will be triggered implicitly
> when all the data needed in input are available (data flow).
>
> KAOS operations are used to operationalize (i.e. fulfill) requirements. Operations constrain the
> space of solutions that can be used by solution providers to design the system that shall meet
> the requirements. Requirements left unoperationalized are called "open requirements"; solution
> providers have the complete freedom to address the requirement as they want. The less open
> requirements are left in the model, the more precise the requirements document will be by
> eliminating possible implementations. In other words, KAOS requirements operationalization
> bridges the gap between the problem description space (goals, requirements and domain objects)
> and the solution description space (operations representing agent behaviors and objects
> interacting with those operations). A good requirements document (and the underlying KAOS model)
> describes the problem as completely as possible, while the specification of a solution is
> limited only to what's really necessary.
>
> **Completeness criterion 5**: All operations are to be justified by the existence of some
> requirements (through the use of operationalization links).
>
> Figure 30 shows the operationalization of a requirement. The operationalization relationship is
> represented as a blue circle. It links the "Execute schedule" operation (Figure 28) to a
> requirements (from Figure 13). The diagram can be read as follows:
> - the "Execute schedule" operation (which reads a "Schedule" in input) is executed in order to
>   operationalize the requirement to have an elevator stopped on calling floor.
> - the "Execute schedule" operation is performed by the "Elevator Controller" agent which is
>   responsible for the requirement.
>
> Figure 30 represents the typical instance of a process pattern Kaos analysts have to reproduce in
> all projects: **the pattern consists in an agent being responsible for a requirement; an
> operation performed by the agent; and an operationalization link between the operation and the
> requirement the agent is responsible for. A requirement is said to be "closed" when this
> triangular relationship Responsibility-Operationalization-Performance has been established.**
>
> Let's now turn our attention to the Reschedule operation. Why do we need that operation? When
> need we reorder existing schedules? Why not just add new commands at the end of the existing
> schedule? The following requirements identified on Figure 16 give a first answer:
> - Moving elevator stopped next floor in case of fire signal
> - Elevator stopped (contributing to Emergency stop available inside the cage)
>
> Because of these cases, it's clear we need to modify the current schedule. Another reason can be
> seen thanks to the scenario we described earlier, the reason being we need to minimize elevator
> moves and the average waiting time. These goals are not yet present in the goal model. They
> should refine the goal "Efficient elevator system" in Figure 5.
>
> This particular situation gives a good example showing that the process of building a KAOS model
> is generally not linear: we can't proceed by first identifying all goals, then set all
> responsibilities, then define the domain vocabulary and finally specify the operations. In each
> phase we can come with new enhancements to any of the 4 models.
>
> The KAOS relationships (refinement, operationalization, responsibility, etc) provide traceability
> between all the pieces of the model. It also gives the analyst flexibility to explore the model
> (from operations to goals or reversely, for instance). Figure 31 outlines a first shot at what an
> efficient elevator system should be. The diagram has been elaborated based on the two goals given
> above.
>
> Figure 32 displays the operationalization diagram for the Reschedule operation.

**Figure 28. Process "Elevator control"** — UNREADABLE (internal layout/labels are an image), but
the prose above gives its content exactly: operations {Reschedule, Execute schedule} as ovals,
objects connected by Input/Output links, events as arrow-sign shapes including "Refresh" (output
of Reschedule, causes/starts Execute schedule) and "Elevator state change" (external event feeding
Execute schedule), triggered by a "Passenger command issued" event.

**Figure 29. Object: State changes and Command events** — UNREADABLE (image). Per the prose: a
partial classification of events into three categories — passenger commands (e.g. button pushed),
elevator state change events (from sensors/floor detection), elevator system command events
(issued by the elevator controller, e.g. "Button light on command", "Stop cage command"). Named
events appearing in the walkthrough: "Floor call button pushed", "Arrival on floor", "Stop cage
command", "Button light on command".

**Figure 30. Operationalization: "Execute schedule"** — UNREADABLE (image: node/link labels,
`DomPre`/`DomPost`, `ReqPre`/`ReqTrig`/`ReqPost` fields if any are not extractable text). Per the
prose: operationalization link (drawn as a blue circle) from the "Execute schedule" operation to a
requirement (from Fig. 13, "elevator stopped on calling floor"); "Execute schedule" reads a
"Schedule" object in input; "Execute schedule" is performed by the "Elevator Controller" agent,
which is also the agent responsible (responsibility link) for that same requirement — i.e. this
figure is the worked example of the responsibility-operationalisation-performance triangle.

**Figure 31. Goal: "Efficient elevator system"** — UNREADABLE (image). Per the prose: refines
"Efficient elevator system" (from Fig. 5) using two requirements from Fig. 16 as justification
("Moving elevator stopped next floor in case of fire signal", "Elevator stopped" contributing to
"Emergency stop available inside the cage") plus new subgoals about minimizing elevator moves and
average waiting time; contains the subgoal "Passengers informed about elevator direction" →
"Elevator direction updated few seconds before next stop" (referenced later, section 3.6).

**Figure 32. Operationalization: "Reschedule"** — UNREADABLE (image). Per the prose: same
operationalisation-diagram form as Figure 30, for the "Reschedule" operation (which produces the
"Refresh" event — see Fig. 28). No further textual detail given.

## 3.6 Dealing with obstacles — figures present (goal/obstacle chapter; not re-transcribed)

Per the task's instruction, Figures 33-35 are already re-keyed in
`packages/lib/test/engines/kaosres/fixtures/elevator.kaos` and are not duplicated here. For
reference, the obstacle chapter (p.34-37) contains:
- **Figure 33.** Obstacle: "Passengers informed of elevator direction" — obstruction link from an
  obstacle ("blind people cannot read the indications") to the goal "Elevator direction updated
  few seconds before next stop" (subgoal of Fig. 31's "Passengers informed about elevator
  direction").
- **Figure 34.** Obstacle resolution: "Passengers informed of elevator direction" — adds a
  resolution link from a new requirement ("Elevator direction announced by voice upon floor
  arrival") to the obstacle of Fig. 33.
- **Figure 35.** Obstacle resolution: "Robust and reliable elevator system" — refinement of
  "Robust and reliable elevator system" with an alternative (OR-) refinement branch for "Worn-out
  components replaced in time".
- **Figure 36** (in section 4, Discussion, p.41): a graph extrapolating return-on-investment vs.
  project size from the authors' experience — not a KAOS model figure, out of scope for the
  oracle.

The chapter's narrated completeness/obstacle rules (also prose, verbatim, not in the fixture):
> Obstacle analysis with KAOS is a goal-oriented activity. It begins with exploring the goal model
> and with negating each goal in turn. ... if goal G is violated, it is because at least one of its
> subgoals is violated (if not, we would reach G).
>
> Obstacles are linked to the goals they obstruct (obstruction link). Obstacles can be refined the
> same way we do with goals, but while goals are generally 'AND-refined', obstacles are most often
> 'OR-refined'.
>
> A first way [to fix an obstacle] consists in defining new requirements that prevent the obstacle
> from occurring... (Resolution link). A second way to fix an obstacle is to restore the obstructed
> goal once the obstacle occurs... A third way to fix an obstacle consists in minimizing its
> effects... It is also possible to fix obstacles by modifying the KAOS model in different ways, for
> instance by substituting an agent with a more "capable" one, by weakening the obstructed goal so
> that the obstacle is no longer relevant or by substituting a goal to another one.

## 6.2 KAOS glossary (p.45-46, verbatim, full)

> **Agent** — Active Object*(=processor) performing operations* to achieve goals*. Agents can be
> the software being considered as a whole or parts of it. Agents can also come from the
> environment* of the software being studied; human agents are in the environment*.
>
> **Association** — Object*, the definition of which relies on other objects linked by the
> association.
>
> **Composite system** — The software being studied and its environment*.
>
> **Conflict** — Goals* are conflicting if under some boundary condition the goals cannot be
> achieved altogether.
>
> **Domain Property** — Descriptive assertion about objects* in the environment* of the software.
> It may be a domain invariant or a hypothesis. A domain invariant is a property known to hold in
> every state of some domain object, e.g., a physical law, regulation, ... A hypothesis is a
> property about some domain object supposed to hold.
>
> **Entity** — Autonomous object*, that is, the definition of which does not rely on other objects.
>
> **Environment** — Part of the universe capable of interaction with the software being studied.
>
> **Event** — Instantaneous object* (that is, an object alive in one state only) which triggers
> operations* performed by agents*.
>
> **Expectation** — Goal* assigned to an agent* in the environment*.
>
> **Formal model** — Model* in which the concepts have been mathematically formalised. In
> Objectiver, the formal model is built on top of a semi-formal model. Only a part or the whole
> semi-formal model can be formalised. Objectiver uses first-order temporal logic with real-time
> extensions to formalise concepts.
>
> **Goal** — Prescriptive assertion capturing some objective to be met by cooperation of agents*; it
> prescribes a set of desired behaviours. Requirements* and expectations* are goals.
>
> **Model** — Abstract representation of a composite system*. An Objectiver model represents a
> composite system* by means of concepts of different types, mainly, objects*, desired or
> undesired properties (goals*, obstacles*), and behaviours (operations*).
>
> **Object** — Thing of interest in the composite system* being modelled whose instances can be
> distinctly identified and may evolve from state to state. Agents, events, entities and
> associations are objects.
>
> **Obstacle** — Condition (other than a goal) whose satisfaction may prevent some goal(s)* from
> being achieved; it defines a set of undesired behaviours.
>
> **Operation** — Specifies state transitions of objects* that are input and/or output of the
> operation. Operations are performed by agents*.
>
> **Operationalisation** — Relationship linking a requirement* to operations*. Holds when each
> execution of the operations (possibly constrained to that intent) will entail the requirement*.
> Makes the connection between expected properties (goals*) and behaviours (operations*).
>
> **Refinement** — Relationship linking a goal* to other goals that are called its subgoals. Each
> subgoal contributes to the satisfaction of the goal* it refines. The conjunction of all the
> subgoals must be a sufficient condition entailing the goal* they refine.
>
> **Requirement** — Goal* assigned to an agent* of the software being studied.
>
> **Responsibility** — Relationship between an agent* and a requirement*. Holds when an agent* is
> assigned the responsibility of achieving the linked requirement*.
>
> **Semi-formal model** — Model* in which the concepts are not mathematically formalised. In
> Objectiver, every concept in the model receives a name, a type, a textual definition, values for
> attributes and a graphical representation.

No `DomPre`/`DomPost`/`Multiplicity`/`Role`/`Frequency`/`Delay`/`Load` entries exist in this
glossary — confirmed by full-text search of the glossary section. They are mentioned nowhere in
the document's extractable text outside of figure images.

## 6.1 KAOS meta-model figure (p.45)

The meta-model diagram itself (the figure immediately preceding the glossary, "sums up the set of
concepts and notations you may find in the methodology") is **UNREADABLE** (image) — no caption or
surrounding prose narrates its node/edge structure beyond pointing to the glossary that follows it.

## Summary of what is usable as an oracle from this document

- The **prose descriptions above are a valid structural oracle**: entity/agent/association
  category definitions, the input/output/cause event structure of a process diagram (Fig. 28/29),
  the operationalisation-triangle rule (Fig. 30, stated twice: once as a diagram description, once
  as an explicit named rule), and the five completeness criteria referenced by number (criteria 3,
  4, 5 — criteria 1-2 are earlier in the goal-model sections, not transcribed here as out of scope
  for #210/#194's operation-model focus).
- **Objectiver's attribute vocabulary (`Multiplicity`, `Role`, `DomPre`, `DomPost`, `Frequency`,
  `Delay`, `Load`) is not present as extractable text anywhere in this PDF.** Builders needing
  those specific attribute names/types should rely on the FSE'02/ICSE'02/KAOS2LTSA sources already
  cited in issue #194, not on this tutorial.
- Nothing here contradicts the already-re-keyed `elevator.kaos` fixture (Figs 33-35); this file
  only adds the responsibility/object/operation-model chapters that fixture doesn't yet cover.
