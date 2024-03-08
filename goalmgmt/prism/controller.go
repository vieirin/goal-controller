package prism

import (
	"bufio"
	"log"
	"os"
	"strconv"
	"strings"
)

type Transition struct {
	next        string
	probability float64
}
type ControllerFile struct {
	TransitionMap map[string][]Transition
}

func transformTransitionIntoMap(transitions []string) map[string][]Transition {
	transitionMap := map[string][]Transition{}
	for _, transitionLine := range transitions {
		splittedLine := strings.Split(transitionLine, " ")
		curr, next, prob := splittedLine[0], splittedLine[1], splittedLine[2]

		transition := Transition{next: next}
		var err error
		transition.probability, err = strconv.ParseFloat(prob, 64)
		if err != nil {
			log.Fatal("couldn't parse probability", err)
		}

		// case exists
		if _, ok := transitionMap[curr]; ok {
			transitionMap[curr] = append(transitionMap[curr], transition)
			continue
		}

		// non-existing entry
		transitionMap[curr] = []Transition{transition}
	}

	return transitionMap
}

func ProcessControllerFile(path string) (*ControllerFile, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err

	}

	scanner := bufio.NewScanner(f)
	// optionally, resize scanner's capacity for lines over 64K, see next example
	firstLine := true
	transitionLines := []string{}
	for scanner.Scan() {
		if firstLine {
			firstLine = false
			continue
		}
		transitionLines = append(transitionLines, scanner.Text())
	}

	return &ControllerFile{
		TransitionMap: transformTransitionIntoMap(transitionLines),
	}, nil
}

func (c ControllerFile) SequenceForInitialState(initialState string) []Transition {
	sequence := []Transition{}

	last := Transition{next: "-1"}
	for transition := c.TransitionMap[initialState][0]; transition.next != last.next; transition = c.TransitionMap[transition.next][0] {
		// decide how to handle different probabilities, currently picking the first elem in the array
		sequence = append(sequence, transition)
		last = transition
	}
	// fmt.Print(initialState, " -> ")
	// for _, elem := range sequence {
	// 	fmt.Print(elem.next, " -> ")
	// }
	// fmt.Println()
	return sequence
}
