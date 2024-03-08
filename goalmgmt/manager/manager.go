package manager

import "github.com/vieirin/goal-controller/goalmgmt/goalModel"

type GoalStateMachine struct {
	ID         string
	Pursued    bool
	Achievable bool
	Achieved   bool
}

func TransformGoalIntoStateMachine(goal goalModel.GoalNode) GoalStateMachine {
	return GoalStateMachine{
		ID:         goal.GoalId,
		Pursued:    false,
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
	goals         []GoalStateMachine
	internalState controllerInternalState
}

func CreateControllerStateMachine(goals []goalModel.GoalNode) ControllerStateMachine {
	stateGoals := []GoalStateMachine{}
	for _, goal := range goals {
		transformedGoal := TransformGoalIntoStateMachine(goal)

		stateGoals = append(stateGoals, transformedGoal)
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
