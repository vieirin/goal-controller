# Fibre-rope mooring (HASE'11)

M. Sabetzadeh, D. Falessi, L. Briand, S. Di Alesio, D. McGeorge, V. Åhjem,
J. Borg. *Combining Goal Models, Expert Elicitation, and Probabilistic
Simulation for Qualification of New Technology*. HASE 2011
([doi:10.1109/HASE.2011.25](https://doi.org/10.1109/HASE.2011.25)),
[the PDF](https://people.svv.lu/sabetzadeh/pub/TQ_HASE11.pdf): a technology
qualification (TQ) study for synthetic fibre-rope mooring, the simplest
sibling of expert elicitation kaosexpert handles — one distribution kind
(triangular, with 5 % tails), no experts, evidence on the leaves instead
(goal-controller#190, #199).

## Where each part comes from

The paper's Figure 2, "Simplified goal model for fiber rope mooring", is
re-keyed in full: GL1 (the top goal), its obstruction tree OB1–OB7, the
mitigating goal GL2 and its subtree GL3–GL11, the eleven evidence items
(ovals) and the assumption AP1. Nothing outside Figure 2 is used.

- **Structure:** GL1 is obstructed by the root obstacle OB1
  ("rope loses structural integrity"), OR-decomposed into OB2 (abrasion),
  OB3 (tension) and OB4 (fatigue); OB3 into OB5 (global tension) and OB6
  (local tension); OB6 into OB7. GL2 mitigates OB7 and is OR-decomposed
  (full) into GL3 and GL4; GL3 and GL5 are AND-decomposed (partial) as the
  paper states explicitly, as is GL8. GL6, GL7, GL9, GL10 and GL11 are the
  five leaf goals, the ones Table II scores.
- **Decomposition completeness:** the paper states explicitly that GL2 is
  OR-decomposed in full and that GL3, GL5 and GL8 are AND-decomposed
  partially (§III-A's text). Every other refinement's completeness is
  drawn in Figure 2 as a filled or an empty circle, which does not survive
  the PDF's text extraction reliably; each is left at kaosprop's default
  (complete, no risk), not guessed from the image.
- **AP1:** the assumption node (usage type = mobile; yarn type, vessel
  type and operating area sanitised in the paper) is a domain hypothesis,
  not wired into the formula — the paper does not quantify it either.
- **GL4:** outside Figure 2's dashed "focus of our case study" boundary,
  the paper gives it no further decomposition or evidence.
- **Evidence items:** the eleven ovals' names, each linked to the leaf
  goal its oval touches in the figure (`Evidence`, a list of ids into
  `evidence.json`); traceability only, no numeric effect.

## What the paper withholds

Section V states twice that the elicited quantities are not published:
"For privacy, we do not report the elicited quantities" and, of Figure
6(b)'s probability density curve for GL3, "we... only report the curve
shape but not the actual numbers." That withholds:

- the five leaf goals' (GL6, GL7, GL9, GL10, GL11) elicited `ESR`
  (triangular distributions, P(G) in the paper's terms);
- α for GL3, GL5 and GL8's AND-decompositions (the paper says these were
  point values in this study, never printed);
- any propagated satisfaction result for GL1, GL2 or GL3 (Figure 6(b) is
  shape only).

This seed leaves every one of those unset: `mooring.kaos` marks each with
a `# ... withheld in HASE'11` comment at the point it would go. Unset
reads as the engine's default — a leaf goal with no `ESR` holds (1), a
hub with no `Probability` (kaosprop's slot, below) has α = 0 (complete) —
so `kaosexpert`'s `uncertainty` analysis still runs end to end on this
seed, at EPS 1 for every goal: not a claim about the real technology, the
engine's documented behaviour for a model with nothing elicited.

The one number the paper does print, in full, is **Figure 3**'s worked
example of the triangular-distribution tail extension (§III-B2): elicited
(a₀, m, b₀) = (0.85, 0.90, 0.96), extended by distributing 5 % of the mass
before a₀ and after b₀, giving (a, m, b) = (0.82548, 0.90, 0.9863). It is
a standalone illustration of the elicitation method, not tied to any one
element of Figure 2's model (the paper never says which quantity, if any,
it is). `mooring.expected.csv` checks it against
`lib.extendTriangular`'s exact solve of the two equations Figure 3
states (see the CSV's header for the small, explained gap between the
paper's printed digits and the exact solve).

## α and β: do they fold into kaosprop's hub `Probability`? (goal-controller#189)

Figure 4's rules, written out against kaosprop's existing propagation
(`packages/lib/src/engines/kaosprop/propagation.ts`, `hubProbability` and
`obstacle`):

- **Goals, complete AND:** `P(G) = Π P(Gᵢ)`. kaosprop's goal hub, "any
  other tactic" rule, is the same product, now also multiplied by the
  hub's own `Probability` (default 1), the same slot the obstacle
  refinement hub already has (`P(O | SO1..n)`, RE'12's).
- **Goals, partial AND, HASE'11 (b):** `P(G) = (1 − α) · Π P(Gᵢ)`. Setting
  the goal hub's `Probability` to `1 − α` gives exactly this formula: a
  straight multiplicative factor on the same product kaosprop's hub
  already computes. **α folds in exactly** — no new key. (`β = 0` for
  goals always, per the paper; kaosprop's goal hub formula has no term
  for it to replace, consistent.)
- **Obstacles, complete OR:** `P(O) = 1 − Π(1 − P(Oᵢ))`, kaosprop's `any`
  across an obstacle's several refinement hubs, unchanged.
- **Obstacles, partial OR, HASE'11 (d):** `P(O) = 1 − (1 − β) · Π(1 −
  P(Oᵢ))`. This multiplies `Π(1 − P(Oᵢ))`, the product of *complements*
  across an obstacle's several refinement hubs — not any one hub's own
  product the way α does, and not a per-hub quantity at all (one β per
  obstacle, however many refinement hubs it has). kaosprop's existing hub
  `Probability` slot has no such product in scope: **β does not fold
  in.** It is `Beta`, its own key on the obstacle (read only when the
  obstacle has more than one refinement — the only situation a partial
  OR's risk is meaningful in), default 0 (`1 − β = 1`, no residual risk,
  the complete-decomposition case).

This model sets neither (§III-A's explicit examples, GL3/GL5/GL8's α, are
withheld); `Beta` is demonstrated in lib's unit tests, not this seed.

## Files

- **`mooring.kaos`:** the project's native file. It opens in kaosexpert's
  mode (the `Evidence` keys and `declare evidence` items are kaosexpert's
  only; nothing elicited is set).
- **`mooring.txt`:** the model as the `.kaos` importer reads it.
- **`evidence.json`:** the eleven evidence items, read from
  `declare evidence`.
- **`mooring.expected.csv`:** Figure 3's tail-extension oracle, and Table
  II's Spearman correlations logged as not reproducible (their inputs are
  withheld). `stress:kaos` checks it.
