package goalModel

import "maps"

type GoalNode struct {
	IsRoot      bool
	GoalTitle   string
	GoalId      string
	IStarID     string
	Cost        int
	Utility     int
	Alternative bool
	Children    []GoalNode
	Relation    string
}

type GoalTree GoalNode
type SequenceNode struct {
	Alternatives []GoalNode
	Node         *GoalNode
}

func (g *GoalNode) AllGoals() map[string]GoalNode {
	goals := map[string]GoalNode{g.GoalId: *g}
	for _, goal := range g.Children {
		childrenGoals := goal.AllGoals()
		maps.Copy(goals, childrenGoals)
	}

	return goals
}
