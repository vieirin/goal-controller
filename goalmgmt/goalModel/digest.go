package goalModel

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/vieirin/goal-controller/goalmgmt/goalModel/data"
)

func getCostAndUtility(iStarNode data.Element) (int, int) {
	utility, cost := 0, 0
	var err error

	if len(iStarNode.CustomProperties.Utility) > 0 {
		utility, err = strconv.Atoi(iStarNode.CustomProperties.Utility)
		if err != nil {
			log.Fatal("Cannot parse utility for goal", iStarNode.Text)
		}
	}

	if len(iStarNode.CustomProperties.Cost) > 0 {
		cost, err = strconv.Atoi(iStarNode.CustomProperties.Cost)
		if err != nil {
			log.Fatal("Cannot parse cost for goal", iStarNode.Text)
		}
	}

	return utility, cost
}

func findLinkForNode(links []data.Link, nodeId string) []data.Link {
	targetLinks := []data.Link{}
	for _, link := range links {
		if link.Target == nodeId {
			targetLinks = append(targetLinks, link)
		}
	}
	return targetLinks
}

func convertIStarRelation(iStarRelation string) string {
	switch iStarRelation {
	case "istar.AndRefinementLink":
		return "and"
	case "istar.OrRefinementLink":
		return "or"
	default:
		return "none"
	}
}

func getChildrenRelation(links []data.Link) string {
	relation := "none"
	for _, link := range links {
		if relation == "none" {
			relation = convertIStarRelation(link.Type)
		} else {
			// check if all relations are the same when
			// looking at the children connected by this link
			nextRelation := convertIStarRelation(link.Type)
			if nextRelation != relation {
				log.Fatalf("Unmatched relation, all children elem needs to have the same relation of the first child. Expected [%s], got [%s]", relation, nextRelation)
			}
			relation = nextRelation
		}
	}
	return relation
}

func nodeChildren(iStarNode data.Element, mappedNodes map[string]data.Element, links []data.Link) ([]GoalNode, string) {
	linksForNode := findLinkForNode(links, iStarNode.ID)
	if len(linksForNode) == 0 {
		return []GoalNode{}, ""
	}

	relation := getChildrenRelation(linksForNode)
	children := []GoalNode{}
	for _, link := range linksForNode {
		elem := mappedNodes[link.Source]
		children = append(children, createNode(elem, mappedNodes, links))
	}
	return children, relation
}

func createNode(iStarNode data.Element, mappedNodes map[string]data.Element, links []data.Link) GoalNode {
	utility, cost := getCostAndUtility(iStarNode)
	children, relation := nodeChildren(iStarNode, mappedNodes, links)
	return GoalNode{
		IsRoot:      iStarNode.CustomProperties.Root == "true",
		GoalTitle:   iStarNode.Text,
		IStarID:     iStarNode.ID,
		Utility:     utility,
		Cost:        cost,
		Alternative: iStarNode.CustomProperties.Alt == "true",
		Children:    children,
		Relation:    relation,
	}
}

func mapNodes(actor data.Actor) map[string]data.Element {
	mappedNodes := map[string]data.Element{}
	for _, node := range actor.Nodes {
		mappedNodes[node.ID] = node
	}
	return mappedNodes
}

func loadGoalModel(file []byte) *GoalNode {
	var model data.GoalModel
	err := json.Unmarshal(file, &model)
	if err != nil {
		fmt.Println(err)
		return nil
	}
	if len(model.Actors) > 1 {
		log.Fatal("Only a single actor is allowed")
		return nil
	}
	actor := model.Actors[0]
	mappedNodes := mapNodes(actor)
	root := actor.Nodes[0]
	node := createNode(root, mappedNodes, model.Links)

	return &node
}

func Digest(filename string) *GoalNode {
	modelFile, err := os.ReadFile(filename)
	if err != nil {
		return nil
	}

	return loadGoalModel(modelFile)
}
