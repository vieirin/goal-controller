"""Semantic comparison of an edgeV2 PRISM model against the EDGE reference.

The reference is first renamed into the edgeV2 namespace (models.name_mapper).
Commands are matched per (owner, label): two commands are equal when their
updates are identical after normalisation and their guards evaluate to the same
truth value on a shared set of random valuations. Formulas are compared the
same way (other formulas are treated as free symbols, so a wrong formula is
reported once, where it is defined). Variables are compared by range and
constants by presence.
"""
from __future__ import annotations

import math
import random
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import prism_expr as px

SAMPLES = 400


@dataclass
class Finding:
    owner: str  # goal / task id the finding belongs to
    construct: str  # reference construct of the owner ('task' for tasks)
    kind: str  # e.g. "missing command", "extra command", "formula differs"
    subject: str  # label / formula / variable name
    reference: str = ""
    edgev2: str = ""


@dataclass
class Report:
    findings: list[Finding] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.findings


def _owner_of(module_name: str, label: str | None, ids: set[str]) -> str:
    if module_name in ids:
        return module_name
    if module_name.startswith("task") and module_name[4:] in ids:
        return module_name[4:]
    if module_name.startswith("G") and module_name[1:] in ids:  # reference GG0
        return module_name[1:]
    if label:  # edgeV2 ChangeManager: owner is the task in the label
        return label.split("_", 1)[1]
    return module_name


def _role(owner: str, label: str) -> str:
    action, target = label.split("_", 1)
    if action == "pursue":
        return "pursue(self)" if target == owner else "pursue(child)"
    return action


def compare(ref_text: str, edge_text: str, root, n: int, seed: int = 0) -> Report:
    import models

    fn = models.name_mapper(root)
    ids = {node.id for node in root.walk()}
    construct_of = {node.id: ("task" if node.is_task else node.construct) for node in root.walk()}
    ref = px.parse_model(ref_text)
    edge = px.parse_model(edge_text)
    report = Report()

    # ---- symbols & valuations --------------------------------------------
    var_ranges: dict[str, tuple] = {}
    for model, rename in ((ref, fn), (edge, lambda s: s)):
        for module in model.modules:
            for v in module.variables:
                var_ranges.setdefault(rename(v.name), (v.low, v.high))

    ref_cmds, edge_cmds = defaultdict(list), defaultdict(list)
    for module in ref.modules:
        for c in module.commands:
            label = fn(c.label)
            owner = _owner_of(module.name, None, ids)
            ref_cmds[(owner, label)].append(
                (px.rename(px.parse_expr(c.guard_text), fn), px.canonical_update(c.update_text, fn), c)
            )
    for module in edge.modules:
        for c in module.commands:
            owner = _owner_of(module.name, c.label, ids)
            if owner not in ids:
                continue  # System / helper modules have no reference counterpart
            edge_cmds[(owner, c.label)].append(
                (px.parse_expr(c.guard_text), px.canonical_update(c.update_text), c)
            )
    ref_formulas = {fn(k): px.rename(px.parse_expr(v), fn) for k, v in ref.formulas.items()}
    edge_formulas = {k: px.parse_expr(v) for k, v in edge.formulas.items()}

    symbols: set[str] = set()
    for group in (ref_cmds, edge_cmds):
        for cmds in group.values():
            for guard, _, _ in cmds:
                symbols |= px.identifiers(guard)
    for asts in (ref_formulas, edge_formulas):
        for ast in asts.values():
            symbols |= px.identifiers(ast)

    rng = random.Random(seed)
    envs = [_valuation(rng, symbols, var_ranges, n, i) for i in range(SAMPLES)]

    def signature(ast):
        out = []
        for env in envs:
            try:
                val = px.evaluate(ast, env)
            except (KeyError, TypeError, ZeroDivisionError) as err:
                val = f"ERR:{type(err).__name__}"
            if isinstance(val, float):
                val = "nan" if math.isnan(val) else round(val, 9)
            if isinstance(val, bool):
                val = int(val)
            out.append(val)
        return tuple(out)

    # ---- commands ----------------------------------------------------------
    for key in sorted(set(ref_cmds) | set(edge_cmds)):
        owner, label = key
        remaining = [(signature(g), u, c) for g, u, c in edge_cmds.get(key, [])]
        for guard, update, c in ref_cmds.get(key, []):
            sig = signature(guard)
            match = next((i for i, (s, u, _) in enumerate(remaining) if s == sig and u == update), None)
            if match is None:
                report.findings.append(Finding(
                    owner, construct_of.get(owner, "?"), f"missing {_role(owner, label)} command", label,
                    reference=f"[{label}] {models.translate_pctl(c.guard_text, fn)} -> {models.translate_pctl(c.update_text, fn)}",
                    edgev2=" || ".join(f"[{label}] {e.guard_text} -> {e.update_text}" for _, _, e in remaining),
                ))
            else:
                remaining.pop(match)
        for _, _, c in remaining:
            report.findings.append(Finding(
                owner, construct_of.get(owner, "?"), f"extra {_role(owner, label)} command", label,
                edgev2=f"[{label}] {c.guard_text} -> {c.update_text}",
            ))

    # ---- formulas ----------------------------------------------------------
    parent_of = {c.id: node.id for node in root.walk() for c in node.children}

    def formula_owner(name: str) -> str:
        owner = _formula_owner(name, ids)
        # X_relative is the share of child X inside its any-order parent
        return parent_of.get(owner, owner) if name.endswith("_relative") else owner

    for name, ast in sorted(ref_formulas.items()):
        owner = formula_owner(name)
        if name not in edge_formulas:
            report.findings.append(Finding(owner, construct_of.get(owner, "?"), "missing formula", name,
                                           edgev2="(not declared)",
                                           reference=f"formula {name} = " + models.translate_pctl(ref.formulas[_unmap(name, ref.formulas, fn)], fn)))
        elif signature(ast) != signature(edge_formulas[name]):
            report.findings.append(Finding(owner, construct_of.get(owner, "?"), "formula differs", name,
                                           reference=f"formula {name} = " + models.translate_pctl(ref.formulas[_unmap(name, ref.formulas, fn)], fn),
                                           edgev2=f"formula {name} = {edge.formulas[name]}"))

    # ---- variables -----------------------------------------------------------
    edge_vars = {v.name: v for m in edge.modules for v in m.variables}
    for module in ref.modules:
        owner = _owner_of(module.name, None, ids)
        for v in module.variables:
            name = fn(v.name)
            ev = edge_vars.get(name)
            if ev is None:
                report.findings.append(Finding(owner, construct_of.get(owner, "?"), "missing variable", name,
                                               reference=f"{name} : [{v.low}..{v.high}]", edgev2="(not declared)"))
            elif (ev.low, ev.high) != (v.low, v.high):
                report.findings.append(Finding(owner, construct_of.get(owner, "?"), "variable range differs", name,
                                               reference=f"{name} : [{v.low}..{v.high}]",
                                               edgev2=f"{name} : [{ev.low}..{ev.high}]"))

    # ---- constants -------------------------------------------------------------
    used = set()
    for module in ref.modules:
        for c in module.commands:
            used |= px.identifiers(px.parse_expr(c.guard_text))
    for v in ref.formulas.values():
        used |= px.identifiers(px.parse_expr(v))
    for name in ref.constants:
        if name not in used:
            continue  # declared by the fuzzer preamble but never referenced
        mapped = fn(name)
        ref_value, edge_value = ref.constants[name], edge.constants.get(mapped)
        if ref_value is not None and edge_value is not None and not _same_value(ref_value, edge_value):
            owner = formula_owner(mapped)
            report.findings.append(Finding(owner, construct_of.get(owner, "model"), "constant value differs", mapped,
                                           reference=f"{mapped} = {ref_value}", edgev2=f"{mapped} = {edge_value}"))
        if mapped not in edge.constants:
            owner = formula_owner(mapped)
            report.findings.append(Finding(owner, construct_of.get(owner, "model"), "missing constant", mapped,
                                           reference=f"const int {mapped};", edgev2="(not declared)"))
    return report


def _same_value(a: str, b: str) -> bool:
    try:
        return abs(float(a) - float(b)) < 1e-12
    except ValueError:
        return a.replace(" ", "") == b.replace(" ", "")


def _formula_owner(name: str, ids: set[str]) -> str:
    for candidate in sorted(ids, key=len, reverse=True):
        if re.match(rf"^_?(decision_)?{candidate}(_|$)", name) or name.startswith(candidate.lower() + "_"):
            return candidate
    return "model"


def _unmap(name, formulas, fn):
    return next((k for k in formulas if fn(k) == name), name)


def _valuation(rng: random.Random, symbols, var_ranges, n: int, i: int) -> dict:
    env = {"N": n}
    probs = [0.0, 0.2, 0.5, 0.8, 1.0]
    for s in symbols:
        if s == "N":
            continue
        if s in var_ranges:
            low, high = var_ranges[s]
            env[s] = rng.random() < 0.5 if low is None else rng.randint(low, high)
        elif s.endswith("_achieved"):
            env[s] = rng.random() < 0.5
        elif s.endswith(("_achievable", "_relative")):
            env[s] = rng.choice(probs) if i % 4 == 0 else rng.random()
        elif "decision_" in s:
            env[s] = rng.randint(0, n)
        else:
            env[s] = rng.randint(0, n)
    return env


def summarise(reports: dict[str, Report]) -> Counter:
    counter: Counter = Counter()
    for report in reports.values():
        for f in report.findings:
            counter[(f.construct, f.kind)] += 1
    return counter
