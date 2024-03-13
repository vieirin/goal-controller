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
	Header    []string
	StateMaps StateMap
}

func transformStateLineInMap(stateLines []string) StateMap {
	stateToLine := map[string]string{}
	lineToState := map[string]string{}
	for _, line := range stateLines {
		splittedLine := strings.Split(line, ":")
		lineNumber, state := splittedLine[0], splittedLine[1]
		// clean up parenthesis
		state = strings.Replace(state, "(", "", 1)
		state = strings.Replace(state, ")", "", 1)
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
	header = strings.Replace(header, "(", "", 1)
	header = strings.Replace(header, ")", "", 1)
	headerStates := strings.Split(header, ",")
	return &StateFile{
		Header:    headerStates,
		StateMaps: transformStateLineInMap(stateLines),
	}, nil
}

func (s *StateFile) StatesMapFromSequence(header []string, transitionSequence []Transition) {
	stateSequence := []map[string]string{}
	for _, transition := range transitionSequence {
		itemMap := map[string]string{}
		states := strings.Split(s.StateMaps.LineToState[transition.next], ",")
		for i, headerName := range header {
			itemMap[headerName] = states[i]
		}
		stateSequence = append(stateSequence, itemMap)
	}
	// for i, elem := range stateSequence {
	// 	fmt.Println(transitionSequence[i].next, elem)
	// }

	// statemachine.transition()
	plan := []string{}
	for _, state := range stateSequence {
		if isPlanningStep := state["n"] == "5"; !isPlanningStep {
			continue
		}

		if inChangeMode := state["t"] == "false"; inChangeMode {
			continue
		}

		for _, headerName := range header {
			value := state[headerName]

			splittedKey := strings.Split(headerName, "_")
			if len(splittedKey) > 1 {
				if splittedKey[1] == "pursued" && value != "0" {
					fmt.Println(state)
					plan = append(plan, splittedKey[0]+"_"+value)
				}
			}
		}
		plan = append(plan, " ")
	}

	fmt.Println(plan)

}
