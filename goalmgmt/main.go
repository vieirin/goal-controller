package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/vieirin/goal-controller/goalmgmt/goalModel"
	"github.com/vieirin/goal-controller/goalmgmt/manager"
	"github.com/vieirin/goal-controller/goalmgmt/prism"
)

func debugState(header []string, stateString string) {
	stateSplit := strings.Split(stateString, ",")
	fmt.Println(stateString)
	for i, head := range header {
		fmt.Print(head, " ")
		fmt.Print(stateSplit[i])
		fmt.Println()
	}

}

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

	for {
		// state string representing the whole system state
		stateString := stateMachine.GetStateString(stateFile.Header)

		// find number line related to the given controller state
		state := stateFile.StateMaps.StateToLine[stateString]
		if state == "" {
			log.Fatal("Could not find state in state map:", stateString)
			break
		}
		// debugState(stateFile.Header, stateString)

		// get sequence of states for a given state
		plannedSequence := controllerFile.SequenceForInitialState(state)

		// trace execution plan from transition sequence
		executionPlan := stateFile.PlanFromTransitionSequence(stateFile.Header, plannedSequence)

		// Execute plan
		fmt.Println("==========")
		fmt.Println("Executing")
		fmt.Println("exec plan", executionPlan)
		stateMachine.Execute(executionPlan)
	}

}
