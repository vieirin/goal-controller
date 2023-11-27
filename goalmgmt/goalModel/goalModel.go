package goalModel

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/vieirin/goal-controller/goalmgmt/goalModel/data"
)

type GoalNode struct {
	IsRoot      bool
	GoalTitle   string
	GoalId      string
	IStarID     string
	Cost        int
	Utility     int
	Alternative bool
}

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
func createNode(iStarNode data.Element) GoalNode {
	utility, cost := getCostAndUtility(iStarNode)
	return GoalNode{
		IsRoot:      iStarNode.CustomProperties.Root == "true",
		GoalTitle:   iStarNode.Text,
		IStarID:     iStarNode.ID,
		Utility:     utility,
		Cost:        cost,
		Alternative: iStarNode.CustomProperties.Alt == "true",
	}
}

func loadGoalModel(file []byte) {
	var model data.GoalModel
	err := json.Unmarshal(file, &model)
	if err != nil {
		fmt.Println(err)
		return
	}
	if len(model.Actors) > 1 {
		log.Fatal("Only a single actor is allowed")
		return
	}
	actor := model.Actors[0]
	nodes := []GoalNode{}
	for _, node := range actor.Nodes {
		nodes = append(nodes, createNode(node))
	}
	fmt.Println(nodes)
}

func Process(filename string) {
	modelFile, err := os.ReadFile(filename)
	if err != nil {
		return
	}

	loadGoalModel(modelFile)
}
