package goalModel

import "fmt"

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

func (g *GoalNode) SequenceGoals() []SequenceNode {
	if len(g.Children) == 0 {
		goalCopy := *g
		return []SequenceNode{{Node: &goalCopy}}
	}

	sequence := []SequenceNode{}
	for _, child := range g.Children {
		seqGoals := child.SequenceGoals()
		if child.Alternative {
			seq := SequenceNode{Node: &child}
			for _, goal := range seqGoals {
				seq.Alternatives = append(seq.Alternatives, *goal.Node)
			}
			sequence = append(sequence, seq)
			continue
		}

		sequence = append(sequence, seqGoals...)
	}
	fmt.Println("seq")
	for _, seq := range sequence {
		if seq.Node.GoalTitle != "" {
			fmt.Printf("%s ", seq.Node.GoalTitle)
		}
	}
	fmt.Println()
	return sequence
}
