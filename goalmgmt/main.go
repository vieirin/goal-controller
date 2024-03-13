package main

import (
	"fmt"
	"log"

	"github.com/vieirin/goal-controller/goalmgmt/goalModel"
	"github.com/vieirin/goal-controller/goalmgmt/manager"
	"github.com/vieirin/goal-controller/goalmgmt/prism"
)

func main() {
	modelTree := goalModel.Digest("../examples/edgeModel.txt")
	if modelTree == nil {
		log.Fatal("Could not load model")
		return
	}

	stateFile, err := prism.ProcessStateFile("./states/state_list")
	if err != nil {
		log.Fatal("Could not load states file")
	}

	controllerFile, err := prism.ProcessControllerFile("./states/adv.tra")
	if err != nil {
		log.Fatal("Could not load controller file")
	}

	goals := modelTree.AllGoals()

	stateMachine := manager.CreateControllerStateMachine(goals)
	stateString := stateMachine.GetStateString(stateFile.Header)

	initialState := stateFile.StateMaps.StateToLine[stateString]
	plannedSequence := controllerFile.SequenceForInitialState(initialState)

	fmt.Println("initial state", initialState)
	stateFile.StatesMapFromSequence(stateFile.Header, plannedSequence)
	return

}
