import json

class Node:
    def __init__(self, node_id, node_type, cost, utility, node_assertion=None):
        self.node_id = node_id
        self.node_type = node_type
        self.assertion = node_assertion
        self.execution_type = None

        self.cost = cost
        self.utility = utility

        self.or_link = []
        self.and_link = []
        self.needed_by_link = []

        self.parent = None

    def add_execution_detail(self, execution_type, execution_detail):
        self.execution_type = execution_type
        self.execution_detail = execution_detail

    def add_link(self, link_type, node):
        match link_type:
            case "and":
                self.and_link.append(node)
            case "or":
                self.or_link.append(node)
            case _:
                raise ZeroDivisionError
        node.parent = self

    def set_execution(self):
        match self.execution_type:
            case "degradation":
                degradation_list = self.execution_detail["degradationList"]
                order_index = {id_: idx for idx, id_ in enumerate(degradation_list)}
                self.and_link = sorted(self.or_link, key=lambda x: order_index[x.node_id])
                self.or_link = []
            case "sequence":
                sequence_list = self.execution_detail["sequence"]
                order_index = {id_: idx for idx, id_ in enumerate(sequence_list)}
                self.and_link = sorted(self.and_link, key=lambda x: order_index[x.node_id])
            case "choice":
                pass
            case "alternative":
                pass
            case None:
                pass
            case _:
                pass

class Parser:
    def __init__(self):
        self.nodes = {}

        self.root = None

    def is_root(self, properties):
        try:
            return properties["root"]
        except KeyError:
            return False

    def add_children(self, node, config):
        link_type = config["relationToChildren"]

        for node_config in config["children"]:
            self.parse_tree(node_config)
            child_node = self.nodes[node_config["id"]]
            node.add_link(link_type, child_node)
            execution_detail = node_config["executionDetail"]
            if execution_detail is not None:
                child_node.add_execution_detail(execution_detail["type"], execution_detail)

    def add_tasks(self, node, config):
        link_type = config["relationToChildren"]

        try:
            for node_config in config["tasks"]:
                self.parse_tree(node_config)
                child_node = self.nodes[node_config["id"]]
                node.add_link(link_type, child_node)
        except KeyError:
            pass

    def parse_execution(self):
        for node in self.nodes.values():
            node.set_execution()

    def parse_tree(self, config):
        properties = config["properties"]
        node_id = config["id"]
        try:
            cost = properties["cost"]
            utility = properties["utility"]
        except KeyError:
            cost, utility = 0, 0
        try:
            assertion = properties["assertion"]
        except KeyError:
            assertion = None

        node = Node(node_id=node_id, node_type=config["type"], cost=cost, utility=utility, node_assertion=assertion)
        self.nodes[config["id"]] = node

        if self.is_root(properties):
            self.root = node

        self.add_children(node, config)
        self.add_tasks(node, config)

    def parse(self, config):
        self.parse_tree(config)
        self.parse_execution()

        return self.nodes, self.root


if __name__ == "__main__":
    with open("goalModel_TAS_3_with_cost_utility.json", "r") as f:
        config = json.load(f)
    parser = Parser()
    parser.parse(config[0])
    pass