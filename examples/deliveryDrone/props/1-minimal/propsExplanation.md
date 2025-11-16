1. “G0 is eventually achieved”

[Inference] In PRISM (DTMC, PCTL), the natural property is:

P=? [ F G0_achieved=1 ]

    •	F means “eventually” (“in the future at some step”).
    •	This gives you the probability that G0 is ever achieved from the initial state.

To check that this matches your intended semantics, you then compare it to your analytic G0_achievable constant:

const double T1_achievable = 0.9;
const double T2_achievable = 0.7;
const double T3_achievable = 0.8;

formula G1_achievable = T1_achievable _ T2_achievable;
formula G2_achievable = T3_achievable;
formula G0_achievable = G1_achievable _ G2_achievable;

[Inference] With these numbers:
• G1_achievable = 0.9 _ 0.7 = 0.63
• G2_achievable = 0.8
• G0_achievable = 0.63 _ 0.8 = 0.504

So in PRISM you should see roughly:

P=? [ F G0_achieved=1 ] ≈ 0.504

If that matches, then the DTMC and your quantitative semantics for AND-refinement are aligned (for this simple “one-shot attempt” model).

⸻

2. “G1 pursues the tasks sequentially [T1; T2]”

You want to encode that T2 is never pursued before T1 is achieved.

2.1. Simple safety property

[Inference] A straightforward invariant is:

P>=1 [ G (T2_pursued=1 -> T1_achieved=1) ]

Interpretation:
• On all paths, at all times (G), whenever T2_pursued holds, T1_achieved already holds.
• If this is satisfied with probability 1, the PRISM model respects the “T1 before T2” ordering.

You may want a stronger version that forbids even trying T2 before T1 is achieved:

P>=1 [ G (T2_achieved=1 -> T1_achieved=1) ]

This asserts that any state where T2 succeeded implies T1 was already succeeded.

2.2. Optional: “no skipping T1”

[Inference] If you also want to make sure that, whenever G1 is pursued, T1 is eventually tried, you can add:

P>=1 [ G (G1_pursued=1 & T1_achieved=0 -> F T1_pursued=1) ]

This is more subtle and may or may not match your intended semantics (it enforces that not only order is respected, but that T1 is not ignored).

⸻

3. “G0 pursues its goals sequentially”

Your goal model says G0 has an AND-refinement into “Navigate” and “Deliver Package” (G1 and G2). You likely want:

Do not pursue G2 before G1 is achieved.

[Inference] In PRISM:

P>=1 [ G (G2_pursued=1 -> G1_achieved=1) ]

You can also check the symmetric “don’t start G1 after G2”, if that is part of your semantics (it depends whether you allow parallelism or strict total order):

P>=1 [ G (G1_pursued=1 & G2_achieved=0 -> !G2_pursued=1) ]

but often the first property (no G2 before G1) is what people mean by “sequential” in this kind of toy example.

⸻

4. “With which probability G0 is achievable?”

You already wrote the compositional formula:

formula G0_achievable = G1_achievable \* G2_achievable;

[Inference] To verify that your DTMC and your analytic formula agree, you can: 1. Ask PRISM for the actual probability:

P=? [ F G0_achieved=1 ]

    2.	Compare the numeric result with G0_achievable (here, 0.504).

PRISM does not directly allow a property like “P=?[F G0_achieved] = G0_achievable”, but you can:
• Evaluate P=? [ F G0_achieved=1 ],
• Check by hand (or in a script) that the difference is essentially 0 (within numerical precision).

Semantically, this checks that your AND-refinement + “one try per leaf task” structure yields a success probability equal to the product of leaf task success probabilities, as intended.

⸻

5. “T3 is eventually achieved”

[Inference] Direct reachability property:

P=? [ F T3_achieved=1 ]

Given your constants, and assuming:
• T3 is tried exactly once when G2 is pursued, and
• there is no retry loop,

this probability should be equal to T3_achievable = 0.8. If PRISM returns ~0.8, your DTMC respects the intended semantics for that task.

⸻

6. Other useful properties to validate semantics

Here are a few additional checks that are often helpful to argue that the PRISM model preserves the goal-model semantics.

6.1. No “early success” of goals

[Inference] Ensure that you never mark goals as achieved too early, e.g. G1 is not achieved unless both T1 and T2 are achieved:

P>=1 [ G (G1_achieved=1 -> (T1_achieved=1 & T2_achieved=1)) ]
P>=1 [ G (G2_achieved=1 -> T3_achieved=1) ]
P>=1 [ G (G0_achieved=1 -> (G1_achieved=1 & G2_achieved=1)) ]

These are direct encodings of your AND semantics.

6.2. Goal-completion implies package delivery

[Inference] If you treat T3_achieved as “package is physically dropped”, you can check that G0 success indeed implies that:

P>=1 [ G (G0_achieved=1 -> T3_achieved=1) ]

This picks up any accidental “shortcut” where you mark G0 as achieved without actually calling T3.

6.3. Deadlock / “stuck” situations

[Inference] You may want to ensure that the system doesn’t get stuck while goals are still pursued:

label "progress" = G0_achieved=1 | (T1_pursued=1 | T2_pursued=1 | T3_pursued=1);

P>=1 [ G ( !progress -> X progress ) ]

or more simply, check for deadlocks using PRISM’s built-in deadlock check (in the GUI) and then refine it:
• Ensure there is no reachable deadlock state where G0_achieved=0 and no tasks are pursued.

6.4. Expected number of steps to success

[Inference] If you attach a reward structure:

rewards "steps"
true : 1;
endrewards

You can ask:

R{"steps"}=? [ F G0_achieved=1 ]

This gives the expected number of steps until G0 is achieved (conditional on it happening at all, under DTMC semantics). It’s not “correctness” per se, but it lets you sanity-check that your operational behaviour matches what you expect (e.g., T1 then T2 then T3, plus some failure branches).

6.5. Probability decompositions

[Inference] To validate that the compositional semantics of your goal model holds, you can also compute:
• Probability only G1 succeeds:

P=? [ F (G1_achieved=1 & G2_achieved=0) ]

    •	Probability only G2 succeeds:

P=? [ F (G2_achieved=1 & G1_achieved=0) ]

    •	Probability neither succeeds:

P=? [ F (G1_achieved=0 & G2_achieved=0) ]

You can then check that:

P(G0 success) + P(G1-only success) + P(G2-only success) + P(neither) = 1

and that these line up with the analytic combinations of T1_achievable, T2_achievable, T3_achievable you’d derive from the goal model.

⸻

7. How this all ties back to “semantics preserved”

[Inference] Informally, what you are doing is: 1. Encoding structural semantics
• AND-refinement ⇒ goals achieved only if all children achieved (checked by the invariants in §6.1).
• Sequential refinement ⇒ child-order invariants (T1 before T2, G1 before G2) in §2 and §3. 2. Encoding quantitative semantics
• Leaf-task success probabilities ⇒ constants Ti_achievable.
• Compositional probability for AND-refinement ⇒ product formulas Gi_achievable and top-level G0_achievable. 3. Checking behavioural and quantitative agreement
• Behaviour: invariants about ordering and “no early achievement”.
• Quantitative: reachability probabilities equal the analytic formulas.

If all these properties hold in PRISM after the modelling issue in §0 is fixed, you have a strong argument that the PRISM DTMC preserves the intended semantics of your tiny goal model.

⸻

If you’d like, [Inference] I can:
• Propose a slightly cleaned-up PRISM model that makes the “sequential execution” more explicit, or
• Help you write a .props file with all these properties ready to paste into PRISM.
