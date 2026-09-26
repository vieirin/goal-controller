# Vendored from EDGE-XT code/evaluation/goal_fuzzer.py (commit 4e63193).
# Reference PRISM encoding of the EDGE goal constructs; do not edit — used as the conformance oracle.
from itertools import combinations
from pathlib import Path
from typing import Callable
import random
from hashlib import sha256


# ---------------------------------------------------------------------------
# Individual goal-modelling constructs
# ---------------------------------------------------------------------------
N = 10

def fixed(id: str, children: list[str]) -> str:
    """
    Generate the PRISM representation of a committed goal.
    Parameters
    ----------
    id:
        Identifier of the goal.
    children:
        Identifiers of the goal's children.
    Returns
    -------
    str
        PRISM model fragment.
    """
    prism = preamble(id, children) + "//fixed \n"
    prism += "g{id}: [0..1] init 0;\n".format(id=id)
    prism += "[pursue_G{id}] !g{id}_achieved & g{id} = 0 -> (g{id}'=1);\n".format(id=id)
    for i, child in enumerate(children):
        prism+= "[pursue_G{child}] !g{id}_achieved & g{id}=1 & G{id}_achievable*N>decision_G{id} ".format(child=child, id=id)
        for prev in children[:i]:
            prism += ("& g{prev}_achieved ".format(prev=prev))
        for c in children:
            if c is not child:
                prism += ("& g{c}=0".format(c=c))
        prism += "-> true; \n"
    prism+= "[skip_G{id}] !g{id}_achieved & g{id}=1 & ".format(id=id)
    for child in children:
        prism += "g{child}=0 & ".format(child=child)
    prism += "G{id}_achievable * N <= decision_G{id} -> (g{id}'=0);\n".format(id=id)
    prism += "[achieved_G{id}] g{id}=1 & g{id}_achieved ".format(id=id)
    for child in children:
        prism += "& g{child}=0 ".format(child=child)
    prism+= ("-> (g{id}'=0); \n"
             " endmodule\n"
             "formula g{id}_achieved = (true").format(id=id)
    for child in children:
        prism += " & g{child}_achieved".format(child=child)
    prism+= (");\n"
             "formula G{id}_achievable = g{id}_achieved ? 0 : 1").format(id=id)
    for child in children:
        prism+= f"* (!g{child}_achieved ? G{child}_achievable : 1)"
    prism+= ";\n"

    pctl = "P=? [ G 0 "
    for child in children:
        pctl += f"+ g{child} "
    pctl += "<= 1 ] =1\n"

    for i, child in enumerate(children):
        pctl += f"P=? [G g{child}=1 => (true "
        for prev in children[:i]:
            pctl += f"& g{prev}_achieved "
        pctl += ")] = 1\n"

    return prism, pctl

def flexible(id: str, children: list[str]) -> str:
    prism = preamble(id, children) + "//flexible\n"
    prism += "g{id}: [0..1] init 0;\n".format(id=id)
    prism += "[pursue_G{id}] !g{id}_achieved & g{id} = 0 -> (g{id}'=1);\n".format(id=id)
    for i, child in enumerate(children):
        prism += "[pursue_G{child}] !g{id}_achieved & g{id}=1 & G{id}_achievable*N>decision_G{id}".format(
            child=child, id=id)
        # At most one child active at a time
        for other in (c for c in children if c != child):
            prism += " & g{other}=0 ".format(other=other)
        # Current child must meet relative-share threshold
        prism += " & G{child}_relative*N".format(child=child)
        prism += ">decision_G{id}_".format(id=id)
        # All higher-priority children must NOT meet the threshold
        for higher_priority_child in children[:i]:
            prism += " & !G{child}_relative".format(child=higher_priority_child)
            prism += "*N>decision_G{id}_".format(id=id)
        prism += " -> true; \n"

    prism += "[skip_G{id}] !g{id}_achieved & g{id}=1 & ".format(id=id)
    for child in children:
        prism += "g{child}=0 & ".format(child=child)
    prism += "G{id}_achievable * N <= decision_G{id} -> (g{id}'=0);\n".format(id=id)
    prism += "[achieved_G{id}] g{id}=1 & g{id}_achieved ".format(id=id)
    for child in children:
        prism += "& g{child}=0 ".format(child=child)
    prism += ("-> (g{id}'=0); \n"
              " endmodule\n"
              "formula g{id}_achieved = (true").format(id=id)
    for child in children:
        prism += " & g{child}_achieved".format(child=child)
    prism += (");\n"
              "formula G{id}_achievable = g{id}_achieved ? 0 : 1").format(id=id)
    for child in children:
        prism += f"* (!g{child}_achieved ? G{child}_achievable : 1)"
    prism += ";\n"

    for child in children:
        prism += f"formula G{child}_relative = g{child}_achieved ? 0 : G{child}_achievable/(G{child}_achievable"
        for other in (c for c in children if c != child):
            prism += f" + (g{other}_achieved ? 0 : G{other}_achievable)"
        prism += ");\n"

    pctl = "P=? [ G 0 "
    for child in children:
        pctl += f"+ g{child} "
    pctl += "<= 1 ] =1\n"

    return prism, pctl

def interleaved(id: str, children: list[str]) -> str:
    prism = preamble(id, children) + "//interleaved \n"
    prism += "g{id}: [0..1] init 0;\n".format(id=id)
    prism += "[pursue_G{id}] !g{id}_achieved & g{id} = 0 -> (g{id}'=1);\n".format(id=id)
    for child in children:
        prism += "[pursue_G{child}] !g{id}_achieved & g{id}=1 & G{child}_achievable*N>decision_G{child} -> true; \n".format(
            child=child, id=id)

    prism += "[skip_G{id}] !g{id}_achieved & g{id}=1 & ".format(id=id)
    for child in children:
        prism += "g{child}=0 & ".format(child=child)
    prism+= "!("
    for child in children:
        prism+= "G{child}_achievable*N>decision_G{child} | ".format(child=child)
    prism += "false) -> (g{id}'=0);\n".format(id=id)
    prism += "[achieved_G{id}] g{id}=1 & g{id}_achieved ".format(id=id)
    for child in children:
        prism += "& g{child}=0 ".format(child=child)
    prism += ("-> (g{id}'=0); \n"
              " endmodule\n"
              "formula g{id}_achieved = (true").format(id=id)
    for child in children:
        prism += " & g{child}_achieved".format(child=child)
    prism += (");\n"
              "formula G{id}_achievable = g{id}_achieved ? 0 : 1").format(id=id)
    for child in children:
        prism += f"* (!g{child}_achieved ? G{child}_achievable : 1)"
    prism += ";\n"
    pctl = ""
    return prism, pctl

def non_idempotent(id: str, children: list[str]) -> str:
    prism = preamble(id, children) + "//non-idempotent \n"
    prism += "g{id}: [0..1] init 0;\n".format(id=id)
    prism += "[pursue_G{id}] !g{id}_achieved & g{id} = 0 -> (g{id}'=1);\n".format(id=id)
    for i, child in enumerate(children):
        prism += "[pursue_G{child}] !g{id}_achieved & g{id}=1 & G{id}_achievable*N>decision_G{id} ".format(
            child=child,
            id=id
        )
        for other in (c for c in children if c != child):
            prism += "& g{other}=0 ".format(other=other)
        # Child must meet the relative-share threshold
        prism += " & (G{child}_achievable/(".format(child=child)
        for other in children:
            prism += "G{other}_achievable+".format(other=other)
        prism += "0))*N > decision_G{id}_ ".format(id=id)
        # Higher-priority children must NOT meet the threshold
        for higher_priority_child in children[:i]:
            prism += (
                "& !(G{child}_achievable/("
                .format(child=higher_priority_child)
            )
            for other in children:
                prism += "G{other}_achievable+".format(other=other)
            prism += (
                "0))*N > decision_G{id}_ "
                .format(id=id)
            )

        prism += "-> true; \n"
    prism += "[skip_G{id}] !g{id}_achieved & g{id}=1 & ".format(id=id)
    for child in children:
        prism += "g{child}=0 & ".format(child=child)
    prism += "G{id}_achievable * N <= decision_G{id} -> (g{id}'=0);\n".format(id=id)
    prism += "[achieved_G{id}] g{id}=1 & g{id}_achieved ".format(id=id)
    for child in children:
        prism += "& g{child}=0 ".format(child=child)
    prism += ("-> (g{id}'=0); \n"
              " endmodule\n"
              "formula g{id}_achieved = (false").format(id=id)
    for child in children:
        prism += " | g{child}_achieved".format(child=child)
    prism += (");\n"
              "formula G{id}_achievable = 0 ").format(id=id)
    for child in children:
        prism += f"+ G{child}_achievable "
    prism += "- (1 "
    for child in children:
        prism += f"* G{child}_achievable "
    prism += ");\n"
    pctl = "P=? [ G 0 "
    for child in children:
        pctl += f"+ g{child} "
    pctl += "<= 1 ] =1"
    return prism, pctl

def committed(id: str, children: list[str]) -> str:
    prism = preamble(id, children) + "//committed \n"
    prism += "g{id}: [0..1] init 0;\n".format(id=id)
    prism += "g{id}_chosen: [0..2] init 0;\n".format(id=id)
    prism += "[pursue_G{id}] !g{id}_achieved & g{id} = 0 -> (g{id}'=1);\n".format(id=id)
    for i, child in enumerate(children):
        prism += "[pursue_G{child}] !g{id}_achieved & g{id}=1 & g{id}_chosen=0 & G{id}_achievable*N>decision_G{id} ".format(
            child=child,
            id=id
        )
        for other in (c for c in children if c != child):
            prism += "& g{other}=0 ".format(other=other)
        # Child must meet the relative-share threshold
        prism += " & (G{child}_achievable/(".format(child=child)
        for other in children:
            prism += "G{other}_achievable+".format(other=other)
        prism += "0))*N > decision_G{id}_ ".format(id=id)
        # Higher-priority children must NOT meet the threshold
        for higher_priority_child in children[:i]:
            prism += (
                "& !(G{child}_achievable/("
                .format(child=higher_priority_child)
            )
            for other in children:
                prism += "G{other}_achievable+".format(other=other)
            prism += (
                "0))*N > decision_G{id}_ "
                .format(id=id)
            )

        prism += "-> (g{id}_chosen'={i}); \n".format(id=id, i=i+1)
        prism += "[pursue_G{child}] !g{id}_achieved & g{id}=1 & g{id}_chosen={i} & G{child}_achievable*N > decision_G{child} -> true;\n".format(child=child,id=id,i=i+1)
    prism += "[skip_G{id}] g{id}_chosen=0 & !g{id}_achieved & g{id}=1 & ".format(id=id)
    for child in children:
        prism += "g{child}=0 & ".format(child=child)
    prism += "G{id}_achievable * N <= decision_G{id} -> (g{id}'=0);\n".format(id=id)
    for i, child in enumerate(children):
        prism += "[skip_G{id}] !g{id}_achieved & g{id}=1 & g{id}=0 & g{id}_chosen={i} & G{child}_achievable*N <= decision_G{child} -> (g{id}'=0);\n".format(id=id, i=i+1, child=child)
    prism += "[achieved_G{id}] g{id}=1 & g{id}_achieved ".format(id=id)
    for child in children:
        prism += "& g{child}=0 ".format(child=child)
    prism += ("-> (g{id}'=0); \n"
              " endmodule\n"
              "formula g{id}_achieved = (false").format(id=id)
    for child in children:
        prism += " | g{child}_achieved".format(child=child)
    prism += (");\n"
              f"formula G{id}_achievable = ")
    for i, child in enumerate(children):
        prism+= f"g{id}_chosen={i+1} ? G{child}_achievable:"
    prism += "(0 "
    for child in children:
        prism += f"+ G{child}_achievable "
    prism += "- 1 "
    for child in children:
        prism += f"* G{child}_achievable "
    prism += ");\n"
    pctl = "P=? [ G 0 "
    for child in children:
        pctl += f"+ g{child} "
    pctl += "<= 1 ] =1\n"

    for i, child in enumerate(children):
        pctl+= f"P=? [G g{child}=1 => g{id}_chosen={i+1} ] =1"

    return prism, pctl

def preferred(id: str, children: list[str]) -> str:
    prism = preamble(id, children) + "//preferred \n"
    prism += "g{id}: [0..1] init 0;\n".format(id=id)
    prism += "g{id}_failed: [0..3] init 0;\n".format(id=id)
    prism += "[pursue_G{id}] !g{id}_achieved & g{id} = 0 -> (g{id}'=1);\n".format(id=id)
    prism += ("[pursue_G{child}] !g{id}_achieved & g{id}=1 & g{id}_failed<3 & G{child}_achievable*N > decision_G{child}"
              " -> (g{id}_failed'=g{id}_failed+1);\n").format(child=children[0], id=id)
    prism += ("[skip_G{id}] !g{id}_achieved & g{id}=1 & g{child}=0 & g{id}_failed<3 & G{child}_achievable*N <= decision_G{child}"
              " -> (g{id}'=0);\n").format(child=children[0], id=id)
    for i, child in enumerate(children):
        prism += "[pursue_G{child}] !g{id}_achieved & g{id}=1 & g{id}_failed=3 & G{id}_achievable*N>decision_G{id} ".format(
            child=child,id=id)
        for other in (c for c in children if c != child):
            prism += "& g{other}=0 ".format(other=other)
        prism += " & (G{child}_achievable/(".format(child=child)
        for other in children:
            prism += "G{other}_achievable+".format(other=other)
        prism += "0))*N > decision_G{id}_ ".format(id=id)
        # All higher-priority children must NOT meet the threshold
        for higher_priority_child in children[:i]:
            prism += " & !(G{child}_achievable/(".format(
                child=higher_priority_child
            )
            for other in children:
                prism += "G{other}_achievable+".format(other=other)
            prism += "0))*N > decision_G{id}_ ".format(id=id)
        prism += " -> true; \n"

    prism += "[skip_G{id}] g{id}_failed=3 & !g{id}_achieved & g{id}=1 & ".format(id=id)
    for child in children:
        prism += "g{child}=0 & ".format(child=child)
    prism += "G{id}_achievable * N <= decision_G{id} -> (g{id}'=0);\n".format(id=id)
    prism += "[achieved_G{id}] g{id}=1 & g{id}_achieved ".format(id=id)
    for child in children:
        prism += "& g{child}=0 ".format(child=child)
    prism += ("-> (g{id}'=0); \n"
              " endmodule\n"
              "formula g{id}_achieved = (g{child}_achieved").format(id=id, child=children[0])
    for child in children[1:]:
        prism += " | (g{id}_failed=3 & g{child}_achieved)".format(child=child, id=id)
    prism += (");\n"
              "formula G{id}_achievable = 0 ").format(id=id)
    for child in children:
        prism += f"+ G{child}_achievable "
    prism += "- (1 "
    for child in children:
        prism += f"* G{child}_achievable "
    prism += ");\n"
    pctl = "P=? [ G 0 "
    for child in children:
        pctl += f"+ g{child} "
    pctl += "<= 1 ] =1\n"

    pctl+= f"P=? [ G g{children[-1]}=1 => g{id}_failed=3 ]=1\n "
    pctl+= f"P=? [ G g{id}_achieved => (g{children[0]}_achieved | (g{id}_failed=3 & g{children[-1]}_achieved)) ]=1 "

    return prism, pctl

def task(id: str, children: list[str]) -> str:

    """

    Generate the PRISM representation of a task.

    Tasks are leaves and therefore cannot have children.

    """

    if children:

        raise ValueError(f"Task {id} cannot have children.")

    prism =  (f"const double G{id}_achievable = 0.8;\n"
            f"formula g{id}_achieved = (g{id}_achieved_=1);\n"
            f"const int decision_G{id} = {int(0.2*N)};\n"
             f"module task{id} \n"
             f"g{id}: [0..1] init 0;\n"
             f"g{id}_achieved_: [0..1] init 0;\n"
             f"[pursue_G{id}] g{id}=0 & g{id}_achieved_=0 -> (g{id}'=1);\n"
             f"[try_G{id}] g{id}=1 & g{id}_achieved_=0 -> "
                f"G{id}_achievable: (g{id}_achieved_'=1) + 1-G{id}_achievable: (g{id}'=0);\n"
             f"[achieved_G{id}] g{id}=1 & g{id}_achieved_=1 -> (g{id}'=0);\n"
            f"endmodule\n")
    pctl = ""
    return prism, pctl

def preamble(id: str, children: list[str]) -> str:
    return (f"const int decision_G{id} = {int(0.2*N)};\n"
            f"const int decision_G{id}_ = {int((N-1)/len(children))};\n"
             f"module G{id} ")

# ---------------------------------------------------------------------------
# Construct registry
# ---------------------------------------------------------------------------

CONSTRUCTS: list[Callable[[str, list[str]], tuple[str, str]]] = [
    fixed,
    flexible,
    interleaved,
    non_idempotent,
    committed,
    preferred
]


def generate_pairwise_model(
    parent: Callable[[str, list[str]], tuple[str, str]],
    child: Callable[[str, list[str]], tuple[str, str]],
) -> tuple[str, str]:
    """
    Generate a three-level pairwise model:

                    parent

                   /      \

                child    child

                /  \      /  \

             task task  task task

    The parent and child are goal constructs, while the bottom
    level always consists of tasks.

    Returns:
        A tuple containing the PRISM model string and the PCTL
        properties string.
    """

    parent_id = "g0"

    child_ids = [
        "g1",
        "g2",
    ]

    task_ids = [
        "t1",
        "t2",
        "t3",
        "t4",
    ]

    # Parent has two children.
    parent_fragment, parent_properties = parent(
        parent_id,
        child_ids,
    )

    # Each child has two tasks.
    child_1_fragment, child_1_properties = child(
        child_ids[0],
        task_ids[0:2],
    )

    child_2_fragment, child_2_properties = child(
        child_ids[1],
        task_ids[2:4],
    )

    # Tasks are leaves.
    task_fragments = []
    task_properties = []

    for task_id in task_ids:
        task_fragment, task_property = task(task_id, [])
        task_fragments.append(task_fragment)
        task_properties.append(task_property)

    model_fragments = [
        parent_fragment,
        child_1_fragment,
        child_2_fragment,
        *task_fragments,
    ]

    property_fragments = [
        parent_properties,
        child_1_properties,
        child_2_properties,
        *task_properties,
    ]

    model = "\n\n".join(model_fragments)
    properties = "\n\n".join(
        fragment for fragment in property_fragments if fragment
    )
    properties += "P=? [F gg0_achieved] > 0.25"
    return model, properties


def generate_pairwise_suite(
    constructs: list[Callable[[str, list[str]], tuple[str, str]]],
    output_dir: str = "generated_models",
) -> None:
    """
    Generate both directions for every pairwise combination.

    For every pair (A, B), generate:

        1. A -> B, B
        2. B -> A, A

    Each model contains two children at every goal level and
    four task leaves.

    The PRISM model is saved as a .prism file and the corresponding
    PCTL properties are saved as a .pctl file.
    """

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    model_index = 1

    for construct_a, construct_b in combinations(constructs, 2):

        name_a = construct_a.__name__
        name_b = construct_b.__name__

        # ---------------------------------------------------------------
        # A -> B
        # ---------------------------------------------------------------

        model_name = f"{model_index:03d}_{name_a}_{name_b}"

        model, properties = generate_pairwise_model(
            construct_a,
            construct_b,
        )

        model = "dtmc\n" f"const int N={N};\n".format(N=N) + model

        print("=" * 80)
        print(model_name)
        print("=" * 80)
        print(model)
        print()

        model_path = output_path / f"{model_name}.prism"
        properties_path = output_path / f"{model_name}.pctl"

        model_path.write_text(model, encoding="utf-8")
        properties_path.write_text(properties, encoding="utf-8")

        model_index += 1

        # ---------------------------------------------------------------
        # B -> A
        # ---------------------------------------------------------------

        model_name = f"{model_index:03d}_{name_b}_{name_a}"

        model, properties = generate_pairwise_model(
            construct_b,
            construct_a,
        )

        model = "dtmc\n" f"const int N={N};\n".format(N=N) + model

        print("=" * 80)
        print(model_name)
        print("=" * 80)
        print(model)
        print()

        model_path = output_path / f"{model_name}.prism"
        properties_path = output_path / f"{model_name}.pctl"

        model_path.write_text(model, encoding="utf-8")
        properties_path.write_text(properties, encoding="utf-8")

        model_index += 1

# ---------------------------------------------------------------------------
# Random model test suite
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------

# Random model generation

# ---------------------------------------------------------------------------

def generate_random_model(
    constructs,
    max_depth=4,
    max_children=3,
    min_children=2,
    seed=None,
):
    if min_children < 2:
        raise ValueError(
            "Goal constructs must have at least two children."
        )

    if max_children < min_children:
        raise ValueError(
            "max_children must be >= min_children."
        )

    rng = random.Random(seed)

    prism_fragments = []
    pctl_fragments = []

    next_id = 0

    goal_constructs = [
        construct
        for construct in constructs
        if construct.__name__ != "task"
    ]

    if not goal_constructs:
        raise ValueError("No goal constructs available.")

    def new_id(prefix):
        nonlocal next_id
        node_id = f"{prefix}{next_id}"
        next_id += 1
        return node_id

    def generate_node(depth):

        # ---------------------------------------------------------
        # Leaf: always a task
        # ---------------------------------------------------------
        if depth == max_depth:

            task_id = new_id("T")

            prism, pctl = task(
                task_id,
                []
            )

            prism_fragments.append(prism)
            pctl_fragments.append(pctl)

            return task_id

        # ---------------------------------------------------------
        # Internal node: always a goal with >= 2 children
        # ---------------------------------------------------------

        goal_id = new_id("G")

        number_of_children = rng.randint(
            min_children,
            max_children,
        )

        children = [
            generate_node(depth + 1)
            for _ in range(number_of_children)
        ]

        construct = rng.choice(goal_constructs)

        prism, pctl = construct(
            goal_id,
            children
        )

        prism_fragments.append(prism)
        pctl_fragments.append(pctl)

        return goal_id

    generate_node(0)

    model = "\n\n".join(prism_fragments)
    properties = "\n".join(pctl_fragments)

    return model, properties

# ---------------------------------------------------------------------------

# Random model suite generation

# ---------------------------------------------------------------------------

def generate_random_suite(

    constructs: list[Callable[[str, list[str]], tuple[str, str]]],

    number_of_models: int,

    output_dir: str = "generated_models",

    max_depth: int = 3,

    max_children: int = 3,

    min_children: int = 2,

) -> None:

    """

    Generate and save a suite of random goal models together with

    their corresponding PCTL property files.

    Random models are named using their seed:

        random_000.prism

        random_000.pctl

        random_001.prism

        random_001.pctl

        ...

    """

    output_path = Path(output_dir)

    output_path.mkdir(parents=True, exist_ok=True)

    for seed in range(number_of_models):

        model, properties = generate_random_model(

            constructs,

            max_depth=max_depth,

            max_children=max_children,

            min_children=min_children,

            seed=seed,

        )

        model_name = f"random_{seed:03d}"

        model = "dtmc\n" f"const int N={N};\n".format(N=N) + model

        model_path = output_path / f"{model_name}.prism"

        properties_path = output_path / f"{model_name}.pctl"

        model_path.write_text(

            model,

            encoding="utf-8",

        )

        properties_path.write_text(

            properties,

            encoding="utf-8",

        )

        print("=" * 80)

        print(model_name)

        print("=" * 80)

        print(model)

        print()

        print("PCTL properties:")

        print(properties)

        print()

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def generate_random_models():
    global N
    N = 10
    generate_pairwise_suite(CONSTRUCTS)
    seen_hashes = set()
    seed = 0
    for i in range(2000):
        while True:
            model, properties = generate_random_model(
                CONSTRUCTS,
                max_depth=4,
                max_children=3,
                seed=seed,
            )
            seed += 1
            model = f"dtmc\nconst int N={N};\n" + model
            model_hash = sha256(model.encode("utf-8")).hexdigest()
            if model_hash not in seen_hashes:
                seen_hashes.add(model_hash)
                break

        model_name = f"random_{i:03d}"
        model_path = Path("generated_models") / f"{model_name}.prism"
        properties_path = Path("generated_models") / f"{model_name}.pctl"

        model_path.write_text(model, encoding="utf-8")
        properties_path.write_text(properties, encoding="utf-8")



def generate_scalability_models(
    discretisations: list[int],
    model_sizes: list[tuple[int, int]],
    models_per_configuration: int = 20,
    output_dir: str = "generated_models",
    seed_offset: int = 0,
):
    """
    Generate random models for different discretisations and model sizes.
    Parameters
    ----------
    discretisations:
        Values of N to test, e.g. [2, 4, 8, 16, 32].
    model_sizes:
        List of (max_depth, max_children) pairs defining the model sizes.
    models_per_configuration:
        Number of random models generated for each
        (N, max_depth, max_children) configuration.
    output_dir:
        Directory in which models and PCTL properties are stored.
    seed_offset:
        Offset applied to the random seeds, useful when repeating
        experiments.
    """
    global N

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    model_index = 0

    for n in discretisations:
        N = n
        for max_depth, max_children in model_sizes:
            for i in range(models_per_configuration):
                seed = seed_offset + model_index
                model, properties = generate_random_model(
                    CONSTRUCTS,
                    max_depth=max_depth,
                    max_children=max_children,
                    seed=seed,
                )
                model_name = (
                    f"random_"
                    f"N{n}_"
                    f"d{max_depth}_"
                    f"w{max_children}_"
                    f"{i:03d}"
                )
                model = (
                    "dtmc\n"
                    f"const int N={N};\n"
                    + model
                )
                model_path = output_path / f"{model_name}.prism"
                properties_path = output_path / f"{model_name}.pctl"
                model_path.write_text(
                    model,
                    encoding="utf-8",
                )
                properties_path.write_text(
                    properties,
                    encoding="utf-8",
                )
                model_index += 1

if __name__ == "__main__":
    # generate_random_models()
    generate_scalability_models(
         discretisations=[10, 5, 20],
         model_sizes=[
             (2, 2),
             (3, 2),
             (4, 2),
             (5, 2),
             (6, 2),
         ],
         models_per_configuration=20,
    )