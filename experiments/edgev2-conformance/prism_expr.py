"""Minimal PRISM model parser and expression evaluator.

Only covers the subset emitted by the EDGE reference fuzzer and the edgeV2
engine: constants, formulas, modules with bounded int / bool variables and
guarded commands. Expressions are parsed into a small AST so guards and
formulas from two models can be compared semantically (by evaluation on
shared random valuations) instead of textually.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Expressions
# ---------------------------------------------------------------------------

_TOKEN = re.compile(
    r"\s*(?:(\d+\.\d*|\d*\.\d+|\d+)|([A-Za-z_][A-Za-z0-9_]*'?)|(<=>|=>|<=|>=|!=|[=<>&|!+\-*/()?:]))"
)


def tokenize(text: str) -> list[str]:
    tokens, pos = [], 0
    text = text.strip()
    while pos < len(text):
        m = _TOKEN.match(text, pos)
        if not m or m.end() == pos:
            raise SyntaxError(f"cannot tokenize {text[pos:pos+20]!r} in {text!r}")
        tokens.append(next(g for g in m.groups() if g is not None))
        pos = m.end()
    return tokens


class _Parser:
    """Recursive descent following PRISM operator precedence (low → high):
    ?:  =>  <=>  |  &  !  (= !=)  (< <= >= >)  (+ -)  (* /)  unary-  atom"""

    def __init__(self, tokens: list[str]):
        self.t, self.i = tokens, 0

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None

    def take(self, expected=None):
        tok = self.peek()
        if expected is not None and tok != expected:
            raise SyntaxError(f"expected {expected!r}, got {tok!r} in {' '.join(self.t)}")
        self.i += 1
        return tok

    def parse(self):
        node = self.ternary()
        if self.peek() is not None:
            raise SyntaxError(f"trailing {self.t[self.i:]} in {' '.join(self.t)}")
        return node

    def ternary(self):
        cond = self.implies()
        if self.peek() == "?":
            self.take()
            a = self.ternary()
            self.take(":")
            b = self.ternary()
            return ("?", cond, a, b)
        return cond

    def implies(self):
        left = self.iff()
        if self.peek() == "=>":
            self.take()
            return ("=>", left, self.implies())
        return left

    def iff(self):
        left = self.or_()
        while self.peek() == "<=>":
            self.take()
            left = ("<=>", left, self.or_())
        return left

    def or_(self):
        left = self.and_()
        while self.peek() == "|":
            self.take()
            left = ("|", left, self.and_())
        return left

    def and_(self):
        left = self.not_()
        while self.peek() == "&":
            self.take()
            left = ("&", left, self.not_())
        return left

    def not_(self):
        if self.peek() == "!":
            self.take()
            return ("!", self.not_())
        return self.eq()

    def eq(self):
        left = self.rel()
        while self.peek() in ("=", "!="):
            op = self.take()
            left = (op, left, self.rel())
        return left

    def rel(self):
        left = self.add()
        while self.peek() in ("<", "<=", ">", ">="):
            op = self.take()
            left = (op, left, self.add())
        return left

    def add(self):
        left = self.mul()
        while self.peek() in ("+", "-"):
            op = self.take()
            left = (op, left, self.mul())
        return left

    def mul(self):
        left = self.unary()
        while self.peek() in ("*", "/"):
            op = self.take()
            left = (op, left, self.unary())
        return left

    def unary(self):
        if self.peek() == "-":
            self.take()
            return ("neg", self.unary())
        return self.atom()

    def atom(self):
        tok = self.take()
        if tok == "(":
            node = self.ternary()
            self.take(")")
            return node
        if tok in ("true", "false"):
            return ("lit", tok == "true")
        if re.fullmatch(r"\d+\.\d*|\d*\.\d+", tok):
            return ("lit", float(tok))
        if tok.isdigit():
            return ("lit", int(tok))
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", tok):
            return ("id", tok)
        raise SyntaxError(f"unexpected {tok!r} in {' '.join(self.t)}")


def parse_expr(text: str):
    return _Parser(tokenize(text)).parse()


def identifiers(node) -> set[str]:
    if node[0] == "id":
        return {node[1]}
    if node[0] == "lit":
        return set()
    return set().union(*(identifiers(c) for c in node[1:]))


def rename(node, fn):
    if node[0] == "id":
        return ("id", fn(node[1]))
    if node[0] == "lit":
        return node
    return (node[0], *(rename(c, fn) for c in node[1:]))


def evaluate(node, env: dict, formulas: dict | None = None):
    op = node[0]
    if op == "lit":
        return node[1]
    if op == "id":
        name = node[1]
        if name in env:
            return env[name]
        if formulas and name in formulas:
            return evaluate(formulas[name], env, formulas)
        raise KeyError(name)
    ev = lambda n: evaluate(n, env, formulas)  # noqa: E731
    if op == "?":
        return ev(node[2]) if ev(node[1]) else ev(node[3])
    if op == "!":
        return not ev(node[1])
    if op == "neg":
        return -ev(node[1])
    if op == "&":
        return bool(ev(node[1])) and bool(ev(node[2]))
    if op == "|":
        return bool(ev(node[1])) or bool(ev(node[2]))
    if op == "=>":
        return (not ev(node[1])) or bool(ev(node[2]))
    if op == "<=>":
        return bool(ev(node[1])) == bool(ev(node[2]))
    a, b = ev(node[1]), ev(node[2])
    if op == "+":
        return a + b
    if op == "-":
        return a - b
    if op == "*":
        return a * b
    if op == "/":
        return a / b if b != 0 else float("nan")
    if op == "=":
        return _close(a, b)
    if op == "!=":
        return not _close(a, b)
    if op == "<":
        return a < b and not _close(a, b)
    if op == "<=":
        return a <= b or _close(a, b)
    if op == ">":
        return a > b and not _close(a, b)
    if op == ">=":
        return a >= b or _close(a, b)
    raise ValueError(op)


def _close(a, b) -> bool:
    if isinstance(a, bool) or isinstance(b, bool):
        return bool(a) == bool(b)
    return abs(a - b) <= 1e-9 * max(1.0, abs(a), abs(b))


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


@dataclass
class Command:
    label: str
    guard_text: str
    update_text: str
    guard: tuple = field(default=None)


@dataclass
class Variable:
    name: str
    low: int | None  # None for bool
    high: int | None
    init: str


@dataclass
class Module:
    name: str
    comment: str
    variables: list[Variable]
    commands: list[Command]


@dataclass
class PrismModel:
    constants: dict[str, str | None]  # name -> value text (None = undefined)
    formulas: dict[str, str]
    modules: list[Module]

    def formula_asts(self):
        return {k: parse_expr(v) for k, v in self.formulas.items()}


_COMMENT = re.compile(r"//[^\n]*")


def parse_model(text: str) -> PrismModel:
    constants: dict[str, str | None] = {}
    formulas: dict[str, str] = {}
    modules: list[Module] = []
    # keep the construct comment on the module line (e.g. "module GG0 //fixed")
    module_re = re.compile(r"^\s*module\s+(\w+)[ \t]*(//[^\n]*)?$(.*?)^\s*endmodule", re.S | re.M)
    for m in module_re.finditer(text):
        body = _COMMENT.sub("", m.group(3))
        variables, commands = [], []
        for stmt in _statements(body):
            if stmt.startswith("["):
                label, rest = stmt[1:].split("]", 1)
                guard, update = rest.split("->", 1)
                commands.append(Command(label.strip(), guard.strip(), update.strip()))
            else:
                vm = re.fullmatch(r"(\w+)\s*:\s*\[\s*(-?\d+)\s*\.\.\s*(-?\d+)\s*\]\s*init\s*(\S+)", stmt)
                bm = re.fullmatch(r"(\w+)\s*:\s*bool\s*init\s*(\S+)", stmt)
                if vm:
                    variables.append(Variable(vm.group(1), int(vm.group(2)), int(vm.group(3)), vm.group(4)))
                elif bm:
                    variables.append(Variable(bm.group(1), None, None, bm.group(2)))
                else:
                    raise SyntaxError(f"unrecognised module statement in {m.group(1)}: {stmt!r}")
        modules.append(Module(m.group(1), (m.group(2) or "").lstrip("/").strip(), variables, commands))
    rest = _COMMENT.sub("", module_re.sub("", text))
    rest = re.sub(r"^\s*rewards\b.*?^\s*endrewards", "", rest, flags=re.S | re.M)  # reward structures are not compared
    for stmt in _statements(rest):
        if stmt in ("dtmc", "mdp", "ctmc") or not stmt:
            continue
        cm = re.fullmatch(r"const\s+(?:int|double|bool)\s+(\w+)(?:\s*=\s*(.+))?", stmt, re.S)
        fm = re.fullmatch(r"formula\s+(\w+)\s*=\s*(.+)", stmt, re.S)
        if cm:
            constants[cm.group(1)] = cm.group(2).strip() if cm.group(2) else None
        elif fm:
            formulas[fm.group(1)] = " ".join(fm.group(2).split())
        elif stmt.startswith(("label", "rewards")):
            continue
        else:
            raise SyntaxError(f"unrecognised top-level statement: {stmt!r}")
    return PrismModel(constants, formulas, modules)


def _statements(text: str) -> list[str]:
    text = re.sub(r"^\s*(dtmc|mdp|ctmc)\s*$", "", text, flags=re.M)
    return [" ".join(s.split()) for s in text.split(";") if s.strip()]


def canonical_update(update: str, rename_fn=lambda s: s) -> str:
    """Normalise an update: rename identifiers, drop whitespace, sort the
    assignments inside each probabilistic branch."""

    def ren(match):
        name = match.group(0)
        return rename_fn(name[:-1]) + "'" if name.endswith("'") else rename_fn(name)

    text = re.sub(r"[A-Za-z_][A-Za-z0-9_]*'?", ren, update.replace(" ", ""))
    if text == "true":
        return text
    branches = _split_top(text, "+") if ":" in text else [text]
    out = []
    for branch in branches:
        prob, _, assigns = branch.rpartition(":") if ":" in branch else ("", "", branch)
        parts = sorted(a.strip("()") for a in _split_top(assigns, "&"))
        out.append((prob + ":" if prob else "") + "&".join(f"({p})" for p in parts))
    return "+".join(out)


def _split_top(text: str, sep: str) -> list[str]:
    parts, depth, cur = [], 0, ""
    for ch in text:
        depth += ch == "("
        depth -= ch == ")"
        if ch == sep and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    parts.append(cur)
    return parts
