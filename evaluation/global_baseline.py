from parse import Parser
import json

def dfs_max_utility(node, visited=None):
    """
    Depth-first search to find the path with the maximum utility.
    Includes all AND-linked nodes, or the single OR-linked child with the highest utility.
    Also accumulates total cost for the chosen path.
    """
    if visited is None:
        visited = set()
    visited.add(node.node_id)

    total_utility = node.utility
    total_cost = node.cost
    path = [node.node_id]

    # Case 1: AND decomposition – include all children
    if node.and_link:
        for child in node.and_link:
            if child.node_id not in visited:
                child_cost, child_utility, child_path = dfs_max_utility(child, visited)
                total_utility += child_utility
                total_cost += child_cost
                path += child_path

    # Case 2: OR decomposition – pick child with maximum utility
    elif node.or_link:
        max_utility = float("-inf")
        best_cost = 0
        best_path = []
        for child in node.or_link:
            if child.node_id not in visited:
                child_cost, child_utility, child_path = dfs_max_utility(child, visited.copy())
                if child_utility > max_utility:
                    max_utility = child_utility
                    best_cost = child_cost
                    best_path = child_path
        total_utility += max_utility
        total_cost += best_cost
        path += best_path

    # Case 3: Leaf node
    return total_cost, total_utility, path

def dfs_min_cost(node, visited=None):
    """
    Depth-first search to find the minimum-cost path.
    Includes all AND-linked nodes, or the cheapest OR-linked subtree.
    """
    if visited is None:
        visited = set()
    visited.add(node.node_id)

    total_cost = node.cost
    total_utility = node.utility
    path = [node.node_id]

    # Case 1: AND decomposition – include all children
    if node.and_link:
        for child in node.and_link:
            if child.node_id not in visited:
                child_cost, child_utility, child_path = dfs_min_cost(child, visited)
                total_cost += child_cost
                total_utility += child_utility
                path += child_path

    # Case 2: OR decomposition – choose one minimum-cost child
    elif node.or_link:
        min_cost = float("inf")
        best_path = []
        for child in node.or_link:
            if child.node_id not in visited:
                child_cost, child_utility, child_path = dfs_min_cost(child, visited.copy())
                if child_cost < min_cost:
                    min_cost = child_cost
                    cur_utility = child_utility
                    best_path = child_path
        total_cost += min_cost
        total_utility += cur_utility
        path += best_path

    # Case 3: Leaf node (no links)
    return total_cost, total_utility, path


if __name__ == "__main__":
    # Load model and parse it
    with open("goalModel_TAS_3_tasks_only_cost_utility.json", "r") as f:
        config = json.load(f)

    parser = Parser()
    nodes, root = parser.parse(config[0])

    # Run DFS from the root (G0)
    total_cost, total_utility, path = dfs_min_cost(root)

    print("Minimum-cost DFS plan:")
    print(" -> ".join(path))
    print(f"Total Cost: {total_cost}")
    print(f"Total Utility: {total_utility}")

    print("\n")
    total_cost, total_utility, path = dfs_max_utility(root)
    print("Maximum-utility DFS plan:")
    print(" -> ".join(path))
    print(f"Total Utility: {total_utility}")
    print(f"Total Cost: {total_cost}")