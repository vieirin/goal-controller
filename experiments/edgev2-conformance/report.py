"""Human-readable conformance report (SUMMARY.md)."""
from __future__ import annotations

import datetime
import subprocess
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

import models

# PRISM command role -> what the rule does, in words
RULE = {
    "pursue(self)": "start rule (when it becomes active)",
    "pursue(child)": "rule for starting a child",
    "skip": "give-up rule (when it stops without being achieved)",
    "achieved": "completion rule (when it is marked done)",
    "try": "attempt rule (the task succeeds with its probability)",
}
FORMULA = {
    "_achieved": "\"achieved\" condition",
    "_achievable": "achievability estimate (drives the pursue/skip decisions)",
    "_relative": "relative share used to pick the next child",
}


@dataclass
class Problem:
    model: str
    owner: str
    construct: str
    text: str  # plain-language problem, without ids
    reference: str = ""
    edgev2: str = ""


def problems_of(model: str, findings) -> list[Problem]:
    """Merge raw findings into plain-language problems (a missing + an extra
    rule with the same label become one 'differs')."""
    out: list[Problem] = []
    by_rule = defaultdict(lambda: {"missing": [], "extra": []})
    for f in findings:
        if f.kind.startswith(("missing ", "extra ")) and f.kind.endswith(" command"):
            side, role = f.kind.split(" ", 1)[0], f.kind.split(" ", 1)[1][: -len(" command")]
            by_rule[(f.owner, f.construct, f.subject, role)][side].append(f)
            continue
        if f.kind in ("formula differs", "missing formula"):
            what = next((v for k, v in FORMULA.items() if f.subject.endswith(k)), "formula")
            text = f"{what} is computed differently" if f.kind == "formula differs" else f"{what} is missing"
        elif f.kind == "missing variable":
            text = "a state variable of the reference is not declared"
        elif f.kind == "variable range differs":
            text = "a state variable has a different range"
        elif f.kind == "missing constant" and f.subject == "N":
            text = "the discretisation constant N is not declared (achievabilities are scaled by a literal instead)"
        elif f.kind == "missing constant":
            text = "a decision constant of the reference is not declared"
        elif f.kind == "edgeV2 generation failed":
            text = "edgeV2 failed to generate the model"
        else:
            text = f.kind
        out.append(Problem(model, f.owner, f.construct, text, f.reference, f.edgev2))
    for (owner, construct, label, role), sides in by_rule.items():
        rule = RULE.get(role, role)
        missing, extra = sides["missing"], sides["extra"]
        if missing and extra:
            text = f"{rule} differs"
        elif missing:
            text = f"{rule} is missing"
        else:
            text = f"{rule} exists in edgeV2 but not in the reference"
        out.append(Problem(
            model, owner, construct, text,
            "\n".join(f.reference for f in missing),
            "\n".join(f.edgev2.split(" || ")[0] if f.edgev2 else "" for f in (extra or missing)),
        ))
    return out


def engine_state(repo: Path) -> str:
    """Commit of the engine that produced the outputs (call at generation time)."""
    return _git_commit(repo)


def _git_commit(repo: Path) -> str:
    try:
        sha = subprocess.run(["git", "-C", str(repo), "rev-parse", "--short", "HEAD"],
                             capture_output=True, text=True, check=True).stdout.strip()
        dirty = subprocess.run(["git", "-C", str(repo), "status", "--porcelain", "--", "packages"],
                               capture_output=True, text=True).stdout.strip()
        return sha + (" + uncommitted engine changes" if dirty else "")
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def _short(text: str, limit: int = 160) -> str:
    return text if len(text) <= limit else text[: limit - 1] + "…"


def render(cases: list[dict], reports: dict, prism: dict, run_info: dict, title: str = "") -> str:
    compared = {k: r for k, r in reports.items()}
    identical = [k for k, r in compared.items() if r.ok]
    generated = [c for c in cases if (c["folder"] / "edgev2.prism").exists()]
    failed = [c for c in cases if not (c["folder"] / "edgev2.prism").exists()]
    edge_only = [c for c in cases if "reference" not in c]
    all_problems = [p for key, r in compared.items() for p in problems_of(key, r.findings)]

    lines = [f"# {title or 'edgeV2 vs EDGE reference — conformance report'}", ""]
    lines += [f"_Outputs generated {run_info.get('date', 'unknown date')} by the edgeV2 engine at "
              f"{run_info.get('engine', 'unknown commit')} · report rendered {datetime.date.today().isoformat()} · "
              f"{len(cases)} models ({sum(c['suite'] == 'reference' for c in cases)} from the EDGE reference suite, "
              f"{sum(c['suite'] == 'freeform' for c in cases)} free-form)_", ""]

    # ---- verdict -------------------------------------------------------------
    lines += ["## Verdict", ""]
    if compared and len(identical) == len(compared):
        lines.append(f"✅ **edgeV2 produces the same PRISM model as the EDGE reference for all {len(compared)} "
                     "models the reference can express** (every rule and formula behaves the same).")
    elif compared:
        lines.append(f"❌ **edgeV2 matches the EDGE reference in {len(identical)} of {len(compared)} models.**")
        differing = Counter()
        for p in all_problems:
            differing[(p.model, p.owner, p.construct)] += 1
        per_type = Counter(models.construct_name(c) for (_, _, c) in differing)
        lines += ["", "Where the differences are (number of goals or tasks affected): "
                  + ", ".join(f"{name} ({n})" for name, n in per_type.most_common()) + "."]
    if edge_only:
        ok = sum((c["folder"] / "edgev2.prism").exists() for c in edge_only)
        lines += ["", f"{len(edge_only)} further models use notation the reference cannot express (goals with one "
                      f"child or no operator, custom retry counts); edgeV2 generated {ok} of them without errors."]
    if failed:
        lines += ["", f"⚠️ edgeV2 failed to generate {len(failed)} model(s) — see the model list below."]
    if prism:
        lines += ["", _prism_verdict(cases, prism)]
    lines.append("")

    # ---- what was checked --------------------------------------------------------
    lines += ["## What was checked", "",
              "- **Reference models** come from the EDGE fuzzer (`EDGE-XT/code/evaluation/goal_fuzzer.py`). "
              "Their goal trees are rebuilt, written as goal models in edgeV2 notation, and converted by edgeV2.",
              "- **Structure:** every PRISM rule and formula in the edgeV2 output is compared with the reference. "
              "Names are translated first (edgeV2 writes `g0_state` where the reference writes `gG0`). Two rules "
              "count as the same when they fire in exactly the same situations (checked on 400 random states) "
              "and have the same effect.",
              "- **Free-form models** exercise the notation beyond the reference: tasks at any depth, 1–4 "
              "children, every operator, custom retry counts and goals without notation.",
              ]
    if prism:
        lines.append("- **PRISM:** each model is loaded and checked in PRISM 4.9: the reference's own properties "
                     "(translated to edgeV2 names) must hold, and the probability of eventually achieving the root "
                     "goal is compared with the reference model under the same decision thresholds.")
    lines.append("")

    # ---- results by goal type ------------------------------------------------------
    per_type = defaultdict(lambda: {"checked": 0, "ok": 0, "problems": Counter(), "generated": 0})
    for case in cases:
        key = f"{case['suite']}/{case['name']}"
        bad_owners = {p.owner for p in all_problems if p.model == key}
        for node in case["root"].walk():
            construct = "task" if node.is_task else node.construct
            row = per_type[construct]
            if key in compared:
                row["checked"] += 1
                row["ok"] += node.id not in bad_owners
            elif (case["folder"] / "edgev2.prism").exists():
                row["generated"] += 1
    for p in all_problems:
        per_type["task" if p.construct == "task" else p.construct]["problems"][p.text] += 1
    lines += ["## Results by goal type", "",
              "| Goal type | Notation | What it does | Compared with reference | Same as reference | Main problem |",
              "|---|---|---|---|---|---|"]
    for construct, (name, notation, meaning) in models.CONSTRUCT_INFO.items():
        row = per_type.get(construct)
        if not row:
            continue
        if row["checked"]:
            same = f"{row['ok']}/{row['checked']}" + (" ✅" if row["ok"] == row["checked"] else " ❌")
        else:
            same = f"not in reference (generated {row['generated']})"
        main = row["problems"].most_common(1)[0][0] if row["problems"] else "—"
        lines.append(f"| {name} | `{notation}` | {meaning} | {row['checked']} | {same} | {main} |")
    lines.append("")

    # ---- problems -------------------------------------------------------------------
    if all_problems:
        lines += ["## Problems found", "",
                  "One section per goal type; each problem comes with one example (edgeV2 names on both sides).", ""]
        by_type = defaultdict(lambda: defaultdict(list))
        for p in all_problems:
            by_type[p.construct][p.text].append(p)
        for construct in [c for c in models.CONSTRUCT_INFO if c in by_type] + \
                [c for c in by_type if c not in models.CONSTRUCT_INFO]:
            row = per_type.get(construct, {"checked": 0, "ok": 0})
            bad = row["checked"] - row["ok"]
            heading = models.construct_name(construct)
            if row["checked"]:
                noun = "tasks" if construct == "task" else "goals"
                heading += f" — {bad} of {row['checked']} {noun} differ"
            lines += [f"### {heading}", ""]
            for text, items in sorted(by_type[construct].items(), key=lambda kv: -len(kv[1])):
                example = items[0]
                lines += [f"**{text[0].upper() + text[1:]}** — {len(items)}× in {len({p.model for p in items})} "
                          f"model(s). Example: `{example.owner}` in `{example.model}`", "", "```"]
                if example.reference:
                    lines += [f"reference: {line}" for line in example.reference.splitlines()]
                if example.edgev2:
                    lines += [f"edgeV2:    {line}" for line in example.edgev2.splitlines()]
                lines += ["```", ""]

    # ---- errata ------------------------------------------------------------------------
    errata = Counter()
    for case in cases:
        errata.update(case.get("errata", {}))
    if errata:
        lines += ["## Defects in the reference that edgeV2 does not copy", "",
                  "These are corrected in the reference before comparing, so they do not count as differences.", ""]
        for key, count in sorted(errata.items()):
            short, why = models.ERRATA[key]
            lines += [f"- **{short}** ({count} occurrences). {why}"]
        lines.append("")

    # ---- PRISM ------------------------------------------------------------------------
    if prism:
        lines += ["## PRISM results", "",
                  "| Model | Loads in PRISM | Properties holding | P(root goal achieved) edgeV2 | reference | Same |",
                  "|---|---|---|---|---|---|"]
        for case in cases:
            lines.append(_prism_row(case, prism))
        lines.append("")

    # ---- models --------------------------------------------------------------------------
    lines += ["## Models", "", "Each model folder holds `goal.txt` (edgeV2 input), `edgev2.prism` (output), "
              "`reference.prism` when the reference can express it, and `findings.json` with the raw differences.", "",
              "| Model | Structure | Result |", "|---|---|---|"]
    for case in cases:
        key = f"{case['suite']}/{case['name']}"
        if not (case["folder"] / "edgev2.prism").exists():
            error = (case["folder"] / "edgev2.error.txt")
            reason = error.read_text().splitlines()[0] if error.exists() else "unknown error"
            result = f"❌ generation failed: {_short(reason, 120)}"
        elif key in compared:
            n = len(problems_of(key, compared[key].findings))
            result = "✅ same as reference" if n == 0 else f"❌ {n} problem(s)"
        else:
            result = "generated (no reference for this notation)"
        lines.append(f"| `{key}` | {_short(models.explain(case['root']), 220)} | {result} |")
    return "\n".join(lines) + "\n"


def _prism_verdict(cases, prism) -> str:
    loaded = holds = total_props = same = compared = 0
    for case in cases:
        edge = prism.get((str(case["folder"]), "edgev2"))
        if not edge:
            continue
        if not edge["error"]:
            loaded += 1
        bools = [r for r in edge["results"] if r in ("true", "false")]
        holds += bools.count("true")
        total_props += len(bools)
        ref = prism.get((str(case["folder"]), "reference"))
        p_edge, p_ref = _probability(edge), _probability(ref) if ref else None
        if p_edge is not None and p_ref is not None:
            compared += 1
            same += abs(p_edge - p_ref) < 1e-6
    ran = sum(1 for c in cases if (str(c["folder"]), "edgev2") in prism)
    if loaded == 0:
        return f"❌ **PRISM:** none of the {ran} edgeV2 models load in PRISM, so no property could be checked."
    icon = "✅" if loaded == ran and holds == total_props and same == compared else "❌"
    return (f"{icon} **PRISM:** {loaded}/{ran} edgeV2 models load, {holds}/{total_props} properties hold, and the "
            f"probability of achieving the root goal equals the reference in {same}/{compared} models.")


def _probability(result) -> float | None:
    if not result:
        return None
    values = [r for r in result["results"] if r not in ("true", "false")]
    try:
        return float(values[-1]) if values else None
    except ValueError:
        return None


def _prism_row(case, prism) -> str:
    key = f"{case['suite']}/{case['name']}"
    edge = prism.get((str(case["folder"]), "edgev2"))
    if edge is None:
        return f"| `{key}` | not run | | | | |"
    ref = prism.get((str(case["folder"]), "reference"))
    if edge["error"]:
        return f"| `{key}` | ❌ {_short(edge['error'], 100)} | | | | |"
    bools = [r for r in edge["results"] if r in ("true", "false")]
    p_edge, p_ref = _probability(edge), _probability(ref)
    same = "—" if p_ref is None or p_edge is None else ("✅" if abs(p_edge - p_ref) < 1e-6 else "❌")
    props = f"{bools.count('true')}/{len(bools)}" + (" ✅" if bools.count("true") == len(bools) else " ❌")
    return (f"| `{key}` | ✅ | {props} | {p_edge if p_edge is not None else '—'} | "
            f"{p_ref if p_ref is not None else 'n/a'} | {same} |")
