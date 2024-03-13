package main

import (
	"fmt"
	"log"
	"strings"

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

	stateFile, err := prism.ProcessStateFile("./states/states.sta")
	if err != nil {
		log.Fatal("Could not load states file")
	}

	controllerFile, err := prism.ProcessControllerFile("./states/controller.txt")
	if err != nil {
		log.Fatal("Could not load controller file")
	}

	goals := modelTree.AllGoals()

	stateMachine := manager.CreateControllerStateMachine(goals)
	stateString := stateMachine.GetStateString(stateFile.Header)
	fmt.Println("initial state", stateString)

	initialState := stateFile.StateMaps.StateToLine[stateString]
	plannedSequence := controllerFile.SequenceForInitialState(initialState)

	executionPlan := stateFile.PlanFromTransitionSequence(stateFile.Header, plannedSequence)

	// transition
	stateMachine.Execute(executionPlan)

	stateString = stateMachine.GetStateString(stateFile.Header)

	nextState := stateFile.StateMaps.StateToLine[stateString]
	state := strings.Split(stateString, ",")
	fmt.Println(stateString)
	for i, head := range stateFile.Header {
		fmt.Print(head, " ")
		fmt.Print(state[i])
		fmt.Println()
	}
	fmt.Printf("n", nextState)

	// plannedSequence = controllerFile.SequenceForInitialState(nextState)
	// executionPlan = stateFile.PlanFromTransitionSequence(stateFile.Header, plannedSequence)

}
