import json

class Node:
    def __init__(self, node_id, node_type, cost, utility, node_assertion=None):
        self.node_id = node_id
        self.node_type = node_type
        self.assertion = node_assertion

        self.cost = cost
        self.utility = utility

        self.or_link = []
        self.and_link = []
        self.needed_by_link = []

        self.parent = None

    def add_execution_detail(self, execution_type, execution_list):
        pass

    def add_link(self, link_type, node):
        match link_type:
            case "and":
                self.and_link.append(node)
            case "or":
                self.or_link.append(node)
            case _:
                raise ZeroDivisionError
        node.parent = self

class Parser:
    def __init__(self):
        self.nodes = {}

        self.root = None

    def parse(self, config):
        properties = config["properties"]
        try:
            cost = properties["cost"]
            utility = properties["utility"]
        except KeyError:
            cost, utility = 0, 0
        try:
            assertion = properties["assertion"]
        except KeyError:
            assertion = None

        node = Node(node_id=config["id"], node_type=config["type"], cost=cost, utility=utility, node_assertion=assertion)
        self.nodes[config["id"]] = node

        try:
            properties["root"]
            self.root = node
        except KeyError:
            pass

        link_type = config["relationToChildren"]

        for node_config in config["children"]:
            self.parse(node_config)
            child_node = self.nodes[node_config["id"]]
            node.add_link(link_type, child_node)
            var = node_config["executionDetail"]
            pass

        try:
            for node_config in config["tasks"]:
                self.parse(node_config)
                child_node = self.nodes[node_config["id"]]
                node.add_link(link_type, child_node)
        except KeyError:
            pass

        return self.nodes, self.root


if __name__ == "__main__":
    with open("goalModel_TAS_3_with_cost_utility.json", "r") as f:
        config = json.load(f)
    parser = Parser()
    parser.parse(config[0])
    pass