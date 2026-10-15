"""goal-controller's oracle for contextual goal models (#151 D1.2, #153).

For every `<name>.dlv` in the jobs directory, DLV 2 enumerates its answer
sets: `<name>.json` is `{"models": [[atom, ...], ...]}`, each model's atoms
sorted, the models sorted; or `{"error": "..."}`.

For `checks.json` (`{"checks": [{"id", "kind", "atoms", "formula" | "a",
"b", "assumptions"}]}`, formulas in SMT-LIB 2 over the boolean `atoms`), z3
gives each verdict: `checks.out.json` is `{"<id>": true | false}`:
`satisfiable` whether formula ∧ assumptions has a model, `implies` whether
assumptions ∧ a ∧ ¬b has none, `equivalent` whether assumptions ∧ (a ≠ b)
has none.
"""
import json
import os
import re
import subprocess
import sys

import z3

jobs, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)


def answer_sets(path):
    run = subprocess.run(
        ["dlv", "--silent", "-n", "0", path],
        capture_output=True,
        text=True,
        timeout=600,
    )
    if run.returncode != 0 and not run.stdout.strip():
        return {"error": (run.stderr or run.stdout).strip()}
    models = []
    for line in run.stdout.splitlines():
        line = line.strip()
        if not (line.startswith("{") and line.endswith("}")):
            continue
        # atoms are separated by ", " outside parentheses
        atoms = re.findall(r"[a-z_][A-Za-z0-9_]*(?:\([^()]*\))?", line[1:-1])
        models.append(sorted(atoms))
    return {"models": sorted(models)}


def verdict(check):
    atoms = " ".join(f"(declare-const |{a}| Bool)" for a in check["atoms"])
    def expr(text):
        return z3.parse_smt2_string(f"{atoms} (assert {text})")[0]
    solver = z3.Solver()
    for assumption in check.get("assumptions", []):
        solver.add(expr(assumption))
    kind = check["kind"]
    if kind == "satisfiable":
        solver.add(expr(check["formula"]))
        return solver.check() == z3.sat
    a, b = expr(check["a"]), expr(check["b"])
    if kind == "implies":
        solver.add(a, z3.Not(b))
    elif kind == "equivalent":
        solver.add(a != b)
    else:
        raise ValueError(f"unknown check {kind}")
    return solver.check() == z3.unsat


for name in sorted(os.listdir(jobs)):
    path = os.path.join(jobs, name)
    if name.endswith(".dlv"):
        result = answer_sets(path)
        with open(os.path.join(out, name[: -len(".dlv")] + ".json"), "w") as f:
            json.dump(result, f, indent=1)
    elif name == "checks.json":
        with open(path) as f:
            checks = json.load(f)["checks"]
        results = {}
        for check in checks:
            try:
                results[check["id"]] = verdict(check)
            except Exception as error:  # a check z3 can't read is reported, not fatal
                results[check["id"]] = f"error: {error}"
        with open(os.path.join(out, "checks.out.json"), "w") as f:
            json.dump(results, f, indent=1)
