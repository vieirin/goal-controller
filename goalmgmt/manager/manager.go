package manager

import (
	"fmt"
	"strings"

	"github.com/vieirin/goal-controller/goalmgmt/goalModel"
)

type GoalStateMachine struct {
	ID         string
	Pursued    int
	Achievable bool
	Achieved   bool
}

func (g GoalStateMachine) Pursue() bool {
	return true
}

func transformGoalIntoStateMachine(goal goalModel.GoalNode) GoalStateMachine {
	return GoalStateMachine{
		ID:         goal.GoalId,
		Pursued:    0,
		Achievable: true,
		Achieved:   false,
	}
}

type controllerInternalState struct {
	n    int
	step int
	fail bool
	t    bool
}
type ControllerStateMachine struct {
	goals         map[string]GoalStateMachine
	internalState controllerInternalState
}

func CreateControllerStateMachine(goals map[string]goalModel.GoalNode) ControllerStateMachine {
	stateGoals := map[string]GoalStateMachine{}
	for id, goal := range goals {
		transformedGoal := transformGoalIntoStateMachine(goal)
		stateGoals[id] = transformedGoal
	}

	return ControllerStateMachine{
		goals: stateGoals,
		internalState: controllerInternalState{
			n:    0,
			step: 0,
			fail: false,
			t:    true,
		},
	}

}

func (c ControllerStateMachine) GetStateString(header string) string {
	stateString := []string{}
	header = strings.Replace(header, "(", "", 1)
	header = strings.Replace(header, ")", "", 1)
	headerStates := strings.Split(header, ",")
	for _, state := range headerStates {
		goalState := strings.Split(state, "_")
		if len(goalState) == 1 {
			// handle system variables
			switch goalState[0] {
			case "n":
				stateString = append(stateString, fmt.Sprintf("%d", c.internalState.n))
			case "step":
				stateString = append(stateString, fmt.Sprintf("%d", c.internalState.step))
			case "fail":
				stateString = append(stateString, fmt.Sprintf("%t", c.internalState.fail))
			case "t":
				stateString = append(stateString, fmt.Sprintf("%t", c.internalState.t))
			}
			continue
		}

		goalId, state_desc := goalState[0], goalState[1]
		goal := c.goals[goalId]
		switch state_desc {
		case "pursued":
			stateString = append(stateString, fmt.Sprintf("%d", goal.Pursued))
		case "achievable":
			stateString = append(stateString, fmt.Sprintf("%t", goal.Achievable))
		case "achieved":
			stateString = append(stateString, fmt.Sprintf("%t", goal.Achieved))
		}
	}

	return "(" + strings.Join(stateString, ",") + ")"
}
