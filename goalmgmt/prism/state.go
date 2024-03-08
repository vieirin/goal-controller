package prism

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type StateMap struct {
	StateToLine map[string]string
	LineToState map[string]string
}
type StateFile struct {
	Header    string
	StateMaps StateMap
}

func transformStateLineInMap(stateLines []string) StateMap {
	stateToLine := map[string]string{}
	lineToState := map[string]string{}
	for _, line := range stateLines {
		splittedLine := strings.Split(line, ":")
		lineNumber, state := splittedLine[0], splittedLine[1]
		stateToLine[state] = lineNumber
		lineToState[lineNumber] = state
	}
	return StateMap{
		StateToLine: stateToLine, LineToState: lineToState,
	}
}

func ProcessStateFile(path string) (*StateFile, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err

	}

	scanner := bufio.NewScanner(f)
	// optionally, resize scanner's capacity for lines over 64K, see next example
	firstLine := true
	header := ""
	stateLines := []string{}
	for scanner.Scan() {
		if firstLine {
			header = scanner.Text()
			firstLine = false
			continue
		}
		stateLines = append(stateLines, scanner.Text())
	}

	return &StateFile{
		Header:    header,
		StateMaps: transformStateLineInMap(stateLines),
	}, nil
}

func (s *StateFile) StatesMapFromSequence(transitionSequence []Transition) {
	stateSequence := []string{}
	for _, transition := range transitionSequence {
		stateSequence = append(stateSequence, s.StateMaps.LineToState[transition.next])
	}
	for i, elem := range stateSequence {
		fmt.Println(transitionSequence[i].next, elem)
	}
}
