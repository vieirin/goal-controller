import ast
import operator

OPS = {
    ast.And: operator.and_,
    ast.Or: operator.or_,
    ast.Not: operator.not_,
    ast.Gt: operator.gt,
    ast.Lt: operator.lt,
    ast.GtE: operator.ge,
    ast.LtE: operator.le,
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
}

def evaluate_assertion(expr: str, env: dict) -> bool:
    """Safely evaluate a logical/numeric assertion string using the environment."""
    expr = expr.strip()
    if not expr:
        return True  # empty assertion = always true

    # Normalize operators
    expr = expr.replace("=", "==").replace("&", " and ").replace("|", " or ")
    expr = expr.replace("===", "==").replace("true", "True").replace("false", "False")

    try:
        tree = ast.parse(expr, mode="eval")
    except SyntaxError:
        # Fall back to simple boolean variable name
        return bool(env.get(expr, False))

    def _eval(node):
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        elif isinstance(node, ast.BoolOp):
            if isinstance(node.op, ast.And):
                return all(_eval(v) for v in node.values)
            elif isinstance(node.op, ast.Or):
                return any(_eval(v) for v in node.values)
        elif isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            return not _eval(node.operand)
        elif isinstance(node, ast.Compare):
            left = _eval(node.left)
            for op, right in zip(node.ops, node.comparators):
                left_val = left
                right_val = _eval(right)
                op_func = OPS[type(op)]
                if not op_func(left_val, right_val):
                    return False
                left = right_val
            return True
        elif isinstance(node, ast.Name):
            val = env.get(node.id, False)
            return val
        elif isinstance(node, ast.Constant):
            return node.value
        else:
            raise ValueError(f"Unsupported expression: {ast.dump(node)}")

    try:
        return bool(_eval(tree))
    except Exception:
        return False
