#!/usr/bin/env python3
"""Module-layout experiment (FINDINGS.md, "Found, documented, not changed").

Takes one edgeV2 output and rewrites only its module layout — the commands,
formulas and constants are untouched — then builds every variant with PRISM's
default (symbolic) engine and with Storm:

  edgev2.prism            as generated: goals in id order, one ChangeManager with all tasks
  split.prism             one module per task, ChangeManager position kept (tasks last)
  goals_postorder.prism   goal modules children-first, ChangeManager kept
  postorder.prism         one module per task + children-first, like the reference
  reference.prism         the EDGE reference model

Usage: python3 layout_experiment.py [DIR]   (default results/layout-experiment/models)
Needs the docker images of README.md (prism49, movesrwth/storm:stable).
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import models  # noqa: E402
import run  # noqa: E402

TIMEOUT = 120
MODULE = re.compile(r"^module (\w+)\n.*?^endmodule", re.S | re.M)


def modules_of(text: str) -> dict[str, str]:
    return {m.group(1): m.group(0) for m in MODULE.finditer(text)}


def without_modules(text: str) -> str:
    return MODULE.sub("", text)


def split_change_manager(text: str) -> str:
    """Replace ChangeManager by one module per task, in its place."""
    manager = modules_of(text)["ChangeManager"]
    body = manager.split("\n", 1)[1].rsplit("endmodule", 1)[0]
    declarations = re.findall(r"^\s*(t(\d+)_\w+: \[0\.\.1\] init 0;)", body, re.M)
    commands = re.findall(r"^\s*(\[(?:pursue|try|achieved)_T(\d+)\].*;)", body, re.M)
    tasks = sorted({task for _, task in declarations}, key=int)
    per_task = "\n\n".join(
        f"module T{t}\n  "
        + "\n  ".join(d for d, owner in declarations if owner == t)
        + "\n  "
        + "\n  ".join(c for c, owner in commands if owner == t)
        + "\nendmodule"
        for t in tasks
    )
    return text.replace(manager, per_task)


def reorder(text: str, order: list[str]) -> str:
    """Declare the listed modules in this order (others keep theirs, after)."""
    mods = modules_of(text)
    rest = [name for name in mods if name not in order]
    return without_modules(text).rstrip() + "\n\n" + "\n\n".join(
        mods[name] for name in [*order, *rest] if name in mods
    ) + "\n"


def postorder(node, goals_only: bool = False):
    for child in node.children:
        yield from postorder(child, goals_only)
    if not (goals_only and node.is_task):
        yield node.id


def build(folder: Path, model: str, checker: str, constants: str) -> str:
    if checker == "prism":
        command = f"timeout -k 10 {TIMEOUT} prism -javamaxmem 4g {model}" + (f" -const {constants}" if constants else "")
        image = run.PRISM_IMAGE
    else:
        command = f"timeout -k 10 {TIMEOUT} storm --prism {model}" + (f" --constants {constants}" if constants else "")
        image = run.STORM_IMAGE
    result = subprocess.run(
        ["docker", "run", "--rm", "-v", f"{folder}:/work", "-w", "/work", image, "bash", "-c", command],
        capture_output=True, text=True,
    )
    log = result.stdout + result.stderr
    states = re.search(r"^States:\s*(\d+)", log, re.M)
    seconds = re.search(r"Time for model construction:\s*([\d.]+)", log)
    if states:
        return f"{states.group(1)} states in {seconds.group(1) if seconds else '?'} s"
    if result.returncode in (124, 137):
        return f"timeout ({TIMEOUT} s)"
    if "CUDD" in log or "Out of memory" in log:
        return "out of memory (CUDD)"
    error = re.search(r"^(Error.*|ERROR.*)$", log, re.M)
    return error.group(0)[:80] if error else "failed"


def main() -> None:
    folder = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "results" / "layout-experiment" / "models"
    folder = folder.resolve()
    data = json.loads((folder / "tree.json").read_text())
    root, n = models.tree_from_dict(data["root"]), data["n"]
    original = (folder / "edgev2.prism").read_text()
    split = split_change_manager(original)

    (folder / "split.prism").write_text(split)
    (folder / "goals_postorder.prism").write_text(reorder(original, list(postorder(root, goals_only=True))))
    (folder / "postorder.prism").write_text(reorder(split, list(postorder(root))))
    (folder / "reference.storm.prism").write_text(run.storm_compatible_reference((folder / "reference.prism").read_text()))

    constants = run.constants_for(original, root, n)
    rows = []
    for model, note in [
        ("edgev2.prism", "as generated"),
        ("split.prism", "one module per task, tasks last"),
        ("goals_postorder.prism", "goals children-first, one ChangeManager"),
        ("postorder.prism", "one module per task, children-first"),
        ("reference.prism", "EDGE reference"),
    ]:
        is_reference = model == "reference.prism"
        prism = build(folder, model, "prism", "" if is_reference else constants)
        storm = build(folder, "reference.storm.prism" if is_reference else model, "storm",
                      "" if is_reference else constants)
        rows.append(f"| `{model}` | {note} | {prism} | {storm} |")
        print(rows[-1], flush=True)

    table = "\n".join(["| model | layout | PRISM 4.9 (symbolic) | Storm 1.14 (sparse) |", "|---|---|---|---|", *rows])
    (folder.parent / "RESULTS.md").write_text(
        "# Module-layout experiment\n\n"
        f"Model: `{models.describe(root)}` (N={n}). Only the module layout differs between the edgeV2 "
        "variants; commands, formulas and constants are identical. Reproduce with "
        "`python3 layout_experiment.py`.\n\n" + table + "\n"
    )


if __name__ == "__main__":
    main()
