package main

import (
	"log"

	"github.com/vieirin/goal-controller/goalmgmt/goalModel"
	"github.com/vieirin/goal-controller/goalmgmt/manager"
)

func main() {
	modelTree := goalModel.Digest("../examples/edgeModel.txt")
	if modelTree == nil {
		log.Fatal("Could not load model")
		return
	}
	goals := modelTree.AllGoals()
	manager.CreateControllerStateMachine(goals)

	return

}
