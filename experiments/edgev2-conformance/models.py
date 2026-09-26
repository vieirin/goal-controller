"""Goal trees for the edgeV2 conformance suite.

A tree can be
  * reconstructed from a reference PRISM model produced by the EDGE fuzzer
    (reference_fuzzer.py), or
  * generated freely to exercise the edgeV2 RT notation.

Every tree can be written as a piStar goal model (the edgeV2 input) and — when
it only uses constructs the reference knows — rendered as the reference PRISM
model plus its PCTL properties.
"""
from __future__ import annotations

import json
import random
import re
import uuid
import warnings
from collections import Counter
from dataclasses import dataclass, field

with warnings.catch_warnings():
    warnings.simplefilter("ignore", SyntaxWarning)
    import reference_fuzzer as ref

# construct name -> (RT notation operator, iStar refinement)
CONSTRUCTS = {
    "fixed": (";", "and"),
    "flexible": ("+", "and"),
    "interleaved": ("#", "and"),
    "non_idempotent": ("|", "or"),
    "committed": ("?", "or"),
    "preferred": ("->", "or"),
}
# extra shapes only edgeV2 knows (no reference encoding)
EXTRA = {"basic_and": (None, "and"), "basic_or": (None, "or")}

REFERENCE_RETRIES = 3  # the fuzzer hard-codes 3 retries for `preferred`


@dataclass
class Node:
    id: str  # "G0" / "T3"
    construct: str | None = None  # None for tasks
    children: list["Node"] = field(default_factory=list)
    retries: int | None = None  # preferred: retries of the first child

    @property
    def is_task(self) -> bool:
        return self.id.startswith("T")

    def walk(self):
        yield self
        for c in self.children:
            yield from c.walk()

    def has_reference(self) -> bool:
        return all(
            n.is_task
            or (n.construct in CONSTRUCTS and len(n.children) >= 2
                and (n.construct != "preferred" or n.retries == REFERENCE_RETRIES))
            for n in self.walk()
        )


# ---------------------------------------------------------------------------
# Reference PRISM  →  tree
# ---------------------------------------------------------------------------

_COMMENT_TO_CONSTRUCT = {
    "fixed": "fixed",
    "flexible": "flexible",
    "interleaved": "interleaved",
    "non-idempotent": "non_idempotent",
    "committed": "committed",
    "preferred": "preferred",
}


def tree_from_reference(text: str) -> tuple[Node, int]:
    import prism_expr

    model = prism_expr.parse_model(text)
    n = int(model.constants["N"])
    nodes: dict[str, Node] = {}
    child_ids: set[str] = set()
    for module in model.modules:
        if module.name.startswith("task"):
            tid = module.name[len("task"):]
            nodes.setdefault(tid, Node(tid))
            continue
        gid = module.name[1:]  # "GG0" -> "G0"
        construct = _COMMENT_TO_CONSTRUCT[module.comment]
        order: list[str] = []
        for cmd in module.commands:
            target = cmd.label[len("pursue_G"):] if cmd.label.startswith("pursue_G") else None
            if target and target != gid and target not in order:
                order.append(target)
        node = nodes.setdefault(gid, Node(gid))
        node.construct = construct
        node.children = [nodes.setdefault(c, Node(c)) for c in order]
        node.retries = REFERENCE_RETRIES if construct == "preferred" else None
        child_ids.update(order)
    roots = [nid for nid in nodes if nid not in child_ids]
    assert len(roots) == 1, roots
    return nodes[roots[0]], n


# ---------------------------------------------------------------------------
# Tree  →  reference PRISM / PCTL
# ---------------------------------------------------------------------------


def reference_model(root: Node, n: int) -> tuple[str, str]:
    assert root.has_reference()
    ref.N = n
    fragments, props = [], []
    for node in root.walk():
        ids = [c.id for c in node.children]
        fn = ref.task if node.is_task else getattr(ref, node.construct)
        prism, pctl = fn(node.id, ids)
        fragments.append(prism)
        if pctl:
            props.append(pctl)
    return f"dtmc\nconst int N={n};\n" + "\n\n".join(fragments), "\n".join(props)


# ---------------------------------------------------------------------------
# Reference errata: defects in the fuzzer output that edgeV2 deliberately does
# not reproduce. They are applied to the reference before comparison and are
# reported separately.
# ---------------------------------------------------------------------------

# erratum id -> (short title, plain-language explanation)
ERRATA = {
    "committed-branch-skip": (
        "Choice goals could never give up on their chosen child",
        "In the reference, the rule that lets a choice goal give up once its chosen child is no longer "
        "worth pursuing requires the goal to be active and inactive at the same time "
        "(`g<id>=1 & g<id>=0`), so it can never fire and the goal gets stuck. The intent is clearly "
        "\"the chosen child is idle\" (`g<child>=0`); edgeV2 implements that.",
    ),
    "committed-chosen-range": (
        "Choice goals with more than two children overflow their memory variable",
        "The reference always declares `g<id>_chosen: [0..2]`. With a third child it assigns "
        "`g<id>_chosen'=3`, which PRISM rejects. edgeV2 declares one value per child.",
    ),
    "committed-pctl-newline": (
        "Choice-goal properties are glued together in the .pctl file",
        "The reference writes the \"only the chosen child runs\" properties without a line break "
        "between them, so PRISM cannot parse them. A newline is inserted.",
    ),
}


def apply_errata(root: Node, prism: str, pctl: str) -> tuple[str, str, Counter]:
    applied: Counter = Counter()
    for node in root.walk():
        if node.construct != "committed":
            continue
        gid = node.id
        for i, child in enumerate(node.children, start=1):
            wrong = f"g{gid}=1 & g{gid}=0 & g{gid}_chosen={i} "
            if wrong in prism:
                prism = prism.replace(wrong, f"g{gid}=1 & g{child.id}=0 & g{gid}_chosen={i} ")
                applied["committed-branch-skip"] += 1
        if len(node.children) > 2:
            wrong = f"g{gid}_chosen: [0..2] init 0;"
            if wrong in prism:
                prism = prism.replace(wrong, f"g{gid}_chosen: [0..{len(node.children)}] init 0;")
                applied["committed-chosen-range"] += 1
    fixed_pctl, count = re.subn(r"\] =1P=\?", "] =1\nP=?", pctl)
    if count:
        applied["committed-pctl-newline"] += count
    return prism, fixed_pctl, applied


# ---------------------------------------------------------------------------
# Naming: reference identifiers  →  edgeV2 identifiers
# ---------------------------------------------------------------------------


def name_mapper(root: Node):
    """Return fn(ref_identifier) -> edgeV2 identifier for this tree."""
    ids = {node.id for node in root.walk()}
    first_child = {
        node.id: node.children[0].id
        for node in root.walk()
        if node.construct == "preferred"
    }
    label_re = re.compile(r"^(pursue|skip|achieved|try)_G(.+)$")

    def low(x: str) -> str:
        return x.lower()

    def fn(name: str) -> str:
        m = label_re.match(name)
        if m and m.group(2) in ids:
            return f"{m.group(1)}_{m.group(2)}"
        if name.startswith("decision_G"):
            rest = name[len("decision_G"):]
            if rest.endswith("_") and rest[:-1] in ids:
                return f"_decision_{rest[:-1]}"
            if rest in ids:
                return f"decision_{rest}"
        if name.startswith("G"):
            for suffix in ("_achievable", "_relative"):
                if name.endswith(suffix) and name[1:-len(suffix)] in ids:
                    return name[1:]
        if name.startswith("g"):
            body = name[1:]
            for suffix, target in (
                ("_achieved_", "_achieved_"),
                ("_achieved", "_achieved"),
                ("_chosen", "_chosen"),
            ):
                if body.endswith(suffix) and body[:-len(suffix)] in ids:
                    return low(body[:-len(suffix)]) + target
            if body.endswith("_failed") and body[:-len("_failed")] in first_child:
                return low(first_child[body[:-len("_failed")]]) + "_failed"
            if body in ids:
                return low(body) + "_state"
        return name

    return fn


def translate_pctl(pctl: str, fn) -> str:
    return re.sub(r"[A-Za-z_][A-Za-z0-9_]*", lambda m: fn(m.group(0)), pctl)


# ---------------------------------------------------------------------------
# Tree  →  piStar goal model (edgeV2 input)
# ---------------------------------------------------------------------------


def notation(node: Node) -> str:
    if node.is_task or not node.children:
        return ""
    op = (CONSTRUCTS.get(node.construct) or EXTRA[node.construct])[0]
    if op is None:
        return ""
    parts = [c.id for c in node.children]
    if node.construct == "preferred" and node.retries:
        parts[0] = f"{parts[0]}@{node.retries}"
    return f" [{op.join(parts)}]"


def relation(node: Node) -> str:
    return (CONSTRUCTS.get(node.construct) or EXTRA[node.construct])[1]


def to_pistar(root: Node, title: str) -> str:
    rng = random.Random(title)
    uid = lambda: str(uuid.UUID(int=rng.getrandbits(128)))  # noqa: E731
    iids: dict[str, str] = {}
    nodes, links = [], []
    for depth_x, node in enumerate(root.walk()):
        iid = iids[node.id] = uid()
        props = {"Description": ""}
        if node is root:
            props["root"] = "true"
        nodes.append({
            "id": iid,
            "text": f"{node.id}: {'task' if node.is_task else 'goal'}{notation(node)}",
            "type": "istar.Task" if node.is_task else "istar.Goal",
            "x": 100 + 60 * depth_x, "y": 100,
            "customProperties": props,
        })
    for node in root.walk():
        for child in node.children:
            links.append({
                "id": uid(),
                "type": "istar.AndRefinementLink" if relation(node) == "and" else "istar.OrRefinementLink",
                "source": iids[child.id],
                "target": iids[node.id],
            })
    model = {
        "actors": [{
            "id": uid(), "text": title, "type": "istar.Actor", "x": 0, "y": 0,
            "customProperties": {"Description": ""}, "nodes": nodes,
        }],
        "orphans": [], "dependencies": [], "links": links, "display": {},
        "tool": "pistar.2.1.0", "istar": "2.0", "saveDate": "",
        "diagram": {"width": 2000, "height": 1000, "customProperties": {"Description": ""}},
    }
    return json.dumps(model, indent=1)


def describe(root: Node) -> str:
    """One-line notation summary of the tree, e.g. G0[G1;T2] G1[T3|T4]."""
    return " ".join(
        f"{n.id}{notation(n).strip() or '(' + n.construct + ':' + ','.join(c.id for c in n.children) + ')'}"
        for n in root.walk()
        if not n.is_task
    )


# ---------------------------------------------------------------------------
# Serialisation and plain-language descriptions
# ---------------------------------------------------------------------------

# construct -> (display name, notation example, what it means)
CONSTRUCT_INFO = {
    "fixed": ("Sequence", "[A;B]", "does every child, one after another, in the written order"),
    "flexible": ("Any order", "[A+B]", "does every child, one at a time, in any order"),
    "interleaved": ("Interleaved", "[A#B]", "does every child, possibly at the same time"),
    "non_idempotent": ("Alternative", "[A|B]", "needs one child; picks again after every failed attempt"),
    "committed": ("Choice", "[A?B]", "needs one child; picks once and sticks with it"),
    "preferred": ("Degradation", "[A@3->B]", "retries the first child up to n times, then falls back to any child"),
    "basic_and": ("AND without notation", "", "no operator written; edgeV2 treats it as interleaved"),
    "basic_or": ("OR without notation", "", "no operator written; edgeV2 treats it as alternative"),
    "task": ("Task", "", "a leaf that succeeds with its achievability probability"),
}


def construct_name(construct: str | None) -> str:
    if construct == "model":
        return "Whole model"
    return CONSTRUCT_INFO.get(construct or "task", (construct or "?",))[0]


def explain(root: Node) -> str:
    """Tree in words, one goal per clause: 'G0 is an alternative between G1 and G4; …'."""
    def ids(nodes):
        names = [n.id for n in nodes]
        return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1]

    parts = []
    for node in root.walk():
        if node.is_task:
            continue
        kids = node.children
        c = node.construct
        if c == "fixed":
            text = "does " + " then ".join(k.id for k in kids)
        elif c == "flexible":
            text = f"does {ids(kids)} in any order"
        elif c == "interleaved":
            text = f"does {ids(kids)} in parallel"
        elif c == "non_idempotent":
            text = f"needs one of {ids(kids)} (alternative)"
        elif c == "committed":
            text = f"needs one of {ids(kids)} (choice, fixed once picked)"
        elif c == "preferred":
            text = f"tries {kids[0].id} up to {node.retries or 0}×, then any of {ids(kids)}" if node.retries \
                else f"needs one of {ids(kids)} (degradation without retries)"
        elif c == "basic_and":
            text = f"needs {ids(kids)} (AND, no notation)"
        else:
            text = f"needs one of {ids(kids)} (OR, no notation)"
        parts.append(f"{node.id} {text}")
    return "; ".join(parts)


def tree_to_dict(node: Node) -> dict:
    return {"id": node.id, "construct": node.construct, "retries": node.retries,
            "children": [tree_to_dict(c) for c in node.children]}


def tree_from_dict(data: dict) -> Node:
    return Node(data["id"], data.get("construct"), [tree_from_dict(c) for c in data.get("children", [])],
                data.get("retries"))


_OPERATORS = [("->", "preferred"), (";", "fixed"), ("+", "flexible"), ("#", "interleaved"),
              ("|", "non_idempotent"), ("?", "committed")]


def tree_from_notation(line: str) -> Node:
    """Inverse of describe(): 'G0[G1|G4] G1[T2;T3] G2(basic_and)'."""
    nodes: dict[str, Node] = {}
    get = lambda i: nodes.setdefault(i, Node(i))  # noqa: E731
    order = []
    for token in line.split():
        m = re.fullmatch(r"(G\d+)(?:\[(.+)\]|\((\w+)(?::([\w,]*))?\))", token)
        if not m:
            raise ValueError(f"cannot parse notation token {token!r}")
        node = get(m.group(1))
        order.append(node)
        if m.group(3):  # goal without notation: G2(basic_and:T3,T4)
            node.construct = m.group(3)
            node.children = [get(c) for c in (m.group(4) or "").split(",") if c]
            continue
        body = m.group(2)
        for op, construct in _OPERATORS:
            if op in body:
                node.construct = construct
                parts = body.split(op)
                break
        else:
            node.construct, parts = "basic_and", [body]
        for part in parts:
            child_id, _, retries = part.partition("@")
            node.children.append(get(child_id))
            if retries:
                node.retries = int(retries)
    return order[0]


def tree_from_pistar(text: str) -> Node:
    """Rebuild the tree from a piStar goal model written by to_pistar()."""
    model = json.loads(text)
    by_iid, root_iid = {}, None
    for node in model["actors"][0]["nodes"]:
        m = re.match(r"([GT]\d+):[^\[]*(?:\[(.+)\])?", node["text"])
        by_iid[node["id"]] = (m.group(1), m.group(2))
        if node.get("customProperties", {}).get("root") == "true":
            root_iid = node["id"]
    nodes = {iid: Node(nid) for iid, (nid, _) in by_iid.items()}
    relation = {}
    for link in model["links"]:
        nodes[link["target"]].children.append(nodes[link["source"]])
        relation[link["target"]] = "or" if "Or" in link["type"] else "and"
    for iid, (_, body) in by_iid.items():
        node = nodes[iid]
        if node.is_task:
            continue
        if not body:
            node.construct = "basic_or" if relation.get(iid) == "or" else "basic_and"
            continue
        parsed = tree_from_notation(f"{node.id}[{body}]")
        node.construct, node.retries = parsed.construct, parsed.retries
        order = [c.id for c in parsed.children]
        node.children.sort(key=lambda c: order.index(c.id))
    return nodes[root_iid]


def generic_pctl(root: Node) -> str:
    """Structural properties in edgeV2 names for any tree (mirrors the
    reference fuzzer's PCTL, generalised to arbitrary retry counts)."""
    state = lambda n: f"{n.id.lower()}_state"  # noqa: E731
    achieved = lambda n: f"{n.id.lower()}_achieved"  # noqa: E731
    props = []
    for node in root.walk():
        if node.is_task or len(node.children) < 2:
            continue
        kids = node.children
        if node.construct in ("fixed", "flexible", "non_idempotent", "committed", "preferred"):
            props.append(f"P>=1 [ G {' + '.join(state(c) for c in kids)} <= 1 ]")
        if node.construct == "fixed":
            for i, c in enumerate(kids[1:], start=1):
                props.append(f"P>=1 [ G {state(c)}=1 => ({' & '.join(achieved(p) for p in kids[:i])}) ]")
        if node.construct == "committed":
            for i, c in enumerate(kids, start=1):
                props.append(f"P>=1 [ G {state(c)}=1 => {node.id.lower()}_chosen={i} ]")
        if node.construct == "preferred" and node.retries:
            failed = f"{kids[0].id.lower()}_failed"
            for c in kids[1:]:
                props.append(f"P>=1 [ G {state(c)}=1 => {failed}={node.retries} ]")
    props.append(f"P=? [ F {achieved(root)} ]")
    return "\n".join(props) + "\n"


# ---------------------------------------------------------------------------
# Free-form generator (exercises the notation beyond the reference fuzzer)
# ---------------------------------------------------------------------------


def random_tree(
    seed: int,
    *,
    max_depth: int = 3,
    min_children: int = 2,
    max_children: int = 4,
    task_probability: float = 0.35,
    reference_only: bool = False,
) -> Node:
    """Random tree with tasks at any depth, 2..max_children children per goal,
    every construct, arbitrary retry counts and (unless reference_only)
    single-child / notation-less goals."""
    rng = random.Random(seed)
    counter = iter(range(10_000))
    constructs = list(CONSTRUCTS)

    def goal(depth: int) -> Node:
        node = Node(f"G{next(counter)}")
        extra = not reference_only and rng.random() < 0.15
        if extra:
            node.construct = rng.choice(list(EXTRA))
            count = rng.choice([1, 1, 2, 3])
        else:
            node.construct = rng.choice(constructs)
            count = rng.randint(min_children, max_children)
        for _ in range(count):
            if depth + 1 >= max_depth or (depth > 0 and rng.random() < task_probability):
                node.children.append(Node(f"T{next(counter)}"))
            else:
                node.children.append(goal(depth + 1))
        if node.construct == "preferred":
            node.retries = REFERENCE_RETRIES if reference_only else rng.choice([1, 2, 3, 3, 5])
        return node

    return goal(0)
