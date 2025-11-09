import json

class Node:
    def __init__(self, node_id, node_type, node_tag, cost, utility, node_assertion=None):
        self.node_id = node_id
        self.node_type = node_type
        self.node_tag = node_tag
        self.assertion = node_assertion

        self.cost = cost
        self.utility = utility

        self.or_link = []
        self.and_link = []
        self.needed_by_link = []

        self.parent = None

    def add_link(self, link_type, node):
        match link_type:
            case "istar.AndRefinementLink":
                self.and_link.append(node)
            case "istar.OrRefinementLink":
                self.or_link.append(node)
            case "istar.NeededByLink":
                self.needed_by_link.append(node)
            case _:
                raise ZeroDivisionError
        node.parent = self

class Parser:
    def __init__(self, config):
        self.config = config
        self.nodes = {}

        self.root = None

    def parse_nodes(self):
        nodes = self.config["actors"][0]["nodes"]
        for node in nodes:
            node_id = node["id"]
            node_type = node["type"]
            node_tag = node["text"].split(":")[0]

            try:
                cost = node["customProperties"]["Cost"]
                utility = node["customProperties"]["Utility"]
            except KeyError:
                cost, utility = 0, 0
            try:
                assertion = node["customProperties"]["assertion"]
            except KeyError:
                assertion = None

            self.nodes[node_id] = (node := Node(node_id, node_type, node_tag, cost, utility, node_assertion=assertion))
            if node_tag == "G0":
                self.root = node

    def parse_links(self):
        links = self.config["links"]
        for link in links:
            source = link["source"]
            target = link["target"]
            node_source = self.nodes[source]
            node_target = self.nodes[target]

            node_target.add_link(link["type"], node_source)

    def parse(self):
        self.parse_nodes()
        self.parse_links()
        return self.nodes, self.root


if __name__ == "__main__":
    with open("goalModel_TAS_3_with_cost_utility.json", "r") as f:
        config = json.load(f)
    parser = Parser(config)
    parser.parse()