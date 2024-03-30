package manager

import (
	"fmt"
	"log"
	"math/rand"
	"strings"

	"github.com/vieirin/goal-controller/goalmgmt/goalModel"
	"github.com/vieirin/goal-controller/goalmgmt/prism"
)

var goalProbabilities = map[string]float64{
	"G2":  1,
	"G3a": 0,
	"G3b": 0,
	"G4a": 1,
	"G4b": 1,
	"G5":  1,
	"G6a": 1,
	"G6b": 1,
}

type GoalStateMachine struct {
	ID         string
	Pursued    int
	Achievable bool
	Achieved   bool
	isVariant  bool
	children   []goalModel.GoalNode
}

func (g GoalStateMachine) Pursue() bool {
	// Generate a random number between 0.0 and 1.0
	randomNumber := rand.Float64()
	return randomNumber <= goalProbabilities[g.ID]
}

func transformGoalIntoStateMachine(goal goalModel.GoalNode) GoalStateMachine {
	return GoalStateMachine{
		ID:         goal.GoalId,
		Pursued:    0,
		Achievable: true,
		Achieved:   false,
		isVariant:  goal.Alternative,
		children:   goal.Children,
	}
}

type controllerInternalState struct {
	n    int
	step int
	fail bool
	t    bool
}
type VariantInfo struct {
	variantRootId string
	lastPursued   int
	variants      map[string]*GoalStateMachine
}
type ControllerStateMachine struct {
	goals         map[string]*GoalStateMachine
	variants      map[string]*VariantInfo
	internalState controllerInternalState
}

func variantGoals(goals map[string]*GoalStateMachine) map[string]*VariantInfo {
	variants := map[string]*VariantInfo{}
	for goalId, goal := range goals {
		if goal.isVariant {
			variantChildren := map[string]*GoalStateMachine{}
			for _, child := range goal.children {
				variantChildren[child.GoalId] = goals[goalId]
			}
			variants[goalId] = &VariantInfo{
				variantRootId: goalId,
				variants:      variantChildren,
			}
		}
	}
	return variants
}

func CreateControllerStateMachine(goals map[string]goalModel.GoalNode) ControllerStateMachine {
	stateGoals := map[string]*GoalStateMachine{}
	for id, goal := range goals {
		transformedGoal := transformGoalIntoStateMachine(goal)
		stateGoals[id] = &transformedGoal
	}

	return ControllerStateMachine{
		goals:    stateGoals,
		variants: variantGoals(stateGoals),
		internalState: controllerInternalState{
			n:    0,
			step: 0,
			fail: false,
			t:    true,
		},
	}

}

// create state string following the order defined by the header
func (c *ControllerStateMachine) GetStateString(header []string) string {
	stateString := []string{}
	for _, state := range header {
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
			if variant, ok := c.variants[goalId]; ok {
				stateString = append(stateString, fmt.Sprintf("%d", variant.lastPursued))
			} else {
				stateString = append(stateString, fmt.Sprintf("%d", goal.Pursued))
			}
		case "achievable":
			stateString = append(stateString, fmt.Sprintf("%t", goal.Achievable))
		case "achieved":
			stateString = append(stateString, fmt.Sprintf("%t", goal.Achieved))
		}
	}

	return strings.Join(stateString, ",")
}

// 1 => a, 2 => b ...
func getVariantName(variant int) string {
	asciiCode := 96 + variant
	variantName := string(rune(asciiCode))
	return variantName
}

// returns a goal object for a given goalId and a variant
// handles the case where the goal is or isn't a variant
func (c *ControllerStateMachine) getGoalForVariant(goalId string, variant int) *GoalStateMachine {
	goalIdWithVariant := goalId + getVariantName(variant)
	var goal *GoalStateMachine
	// some goals may have variants so we try it first
	if maybeGoalWithVariant, ok := c.goals[goalIdWithVariant]; ok {
		goal = maybeGoalWithVariant
	} else {
		goal = c.goals[goalId]
	}
	return goal
}

func (c *ControllerStateMachine) Execute(executionPlan []prism.PlanItem) {
	c.internalState.step = 0

	for _, goalInPlan := range executionPlan {
		goal := c.getGoalForVariant(goalInPlan.GoalId, goalInPlan.Variant)
		pursueResult := goal.Pursue()
		fmt.Println(goal.ID, pursueResult)

		// Pursuing effects
		goal.Pursued = goalInPlan.Variant
		// update variant with last pursued goal
		if variant, isVariant := c.variants[goalInPlan.GoalId]; isVariant {
			variant.lastPursued = goalInPlan.Variant
		}

		if pursueResult {
			// perform effects for when it succeds
			goal.Achieved = true
		} else {
			// perform effects for when it fails
			goal.Achievable = false
			c.internalState.fail = true
			// we shouldn't peform new goals until a new plan is defined
			break
		}

		c.internalState.step++
	}

	if !c.internalState.fail && c.internalState.step == len(executionPlan) {
		fmt.Println("Success")
		c.internalState.step++
	}

	if c.internalState.step == len(executionPlan)+1 {
		fmt.Println("Should send signal to stop")
		log.Fatal("STOP SIGNAL")
	}

	c.internalState.fail = false
	c.internalState.step = 0
}
