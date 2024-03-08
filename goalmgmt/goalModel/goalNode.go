package goalModel

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

func (g *GoalNode) AllGoals() []GoalNode {
	goals := []GoalNode{*g}
	for _, goal := range g.Children {
		childrenGoals := goal.AllGoals()
		goals = append(goals, childrenGoals...)
	}

	return goals
}
