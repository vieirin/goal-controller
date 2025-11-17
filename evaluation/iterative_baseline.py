from parse import Parser
from evaluate_assertion import evaluate_assertion
import json

# 🌍 Environment variables
environment = {
  "R0": True,                # from "R0=true"
  "R1": 51,                  # from "R1>50" -> set to 51 to satisfy
  "R3": True,                # from "R3=true"
  "R4": 36,                  # from "R4>35" -> set to 36 to satisfy
  "atHome": True,            # from "pharmacyAvailable&atHome"
  "enoughBattery": True,
  "highReliability": True,
  "inEmergency": True,
  "medicationApplied": True,
  "networkAvailable": True,
  "patientTracking": True,
  "pharmacyAvailable": True,
  "privacyEnabled": True,
  "sensorAvailable": True
}

def dfs_min_cost(node, visited=None):
    """
    Depth-first search to find the path with the minimum total cost.
    Includes all AND-linked children, or chooses one OR-linked child
    with the lowest total cost. Skips nodes whose assertions fail.
    """
    if visited is None:
        visited = set()
    visited.add(node.node_id)

    # --- Skip node if its assertion fails ---
    if node.assertion and not evaluate_assertion(node.assertion, environment):
        return float("inf"), 0, []  # cost = inf so it won't be chosen

    total_cost = node.cost
    total_utility = node.utility
    path = [node.node_id]

    # Case 1: AND decomposition → must include all children
    if node.and_link:
        for child in node.and_link:
            if child.node_id not in visited:
                child_cost, child_utility, child_path = dfs_min_cost(child, visited)
                total_cost += child_cost
                total_utility += child_utility
                path += child_path

    # Case 2: OR decomposition → choose cheapest child path
    elif node.or_link:
        best_cost = float("inf")
        best_utility = 0
        best_path = []
        for child in node.or_link:
            if child.node_id not in visited:
                child_cost, child_utility, child_path = dfs_min_cost(child, visited.copy())
                if child_cost < best_cost:
                    best_cost = child_cost
                    best_utility = child_utility
                    best_path = child_path
        if best_cost < float("inf"):
            total_cost += best_cost
            total_utility += best_utility
            path += best_path

    return total_cost, total_utility, path

def dfs_max_utility(node, visited=None):
    if visited is None:
        visited = set()
    visited.add(node.node_id)

    # Skip node if its assertion fails
    if node.assertion and not evaluate_assertion(node.assertion, environment):
        return float("inf"), 0, []  # skip node completely

    total_utility = node.utility
    total_cost = node.cost
    path = [node.node_id]

    if node.and_link:
        for child in node.and_link:
            if child.node_id not in visited:
                child_cost, child_utility, child_path = dfs_max_utility(child, visited)
                total_utility += child_utility
                total_cost += child_cost
                path += child_path

    elif node.or_link:
        max_util = float("-inf")
        best_cost = 0
        best_path = []
        for child in node.or_link:
            if child.node_id not in visited:
                child_cost, child_utility, child_path = dfs_max_utility(child, visited.copy())
                if child_utility > max_util:
                    max_util = child_utility
                    best_cost = child_cost
                    best_path = child_path
        if max_util > float("-inf"):
            total_utility += max_util
            total_cost += best_cost
            path += best_path

    return total_cost, total_utility, path


if __name__ == "__main__":
    with open("goalModel_TAS_3_tasks_only_cost_utility.json", "r") as f:
        config = json.load(f)

    parser = Parser()
    nodes, root = parser.parse(config[0])

    total_cost, total_utility, path = dfs_min_cost(root)
    print("Minimum-cost DFS plan (with assertions):")
    print(" -> ".join(path))
    print(f"Total Utility: {total_utility}")
    print(f"Total Cost: {total_cost}")
    print("\n\n")

    total_cost, total_utility, path = dfs_max_utility(root)
    print("Maximum-utility DFS plan (with assertions):")
    print(" -> ".join(path))
    print(f"Total Utility: {total_utility}")
    print(f"Total Cost: {total_cost}")
