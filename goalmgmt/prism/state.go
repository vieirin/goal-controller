package prism

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strconv"
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

// return an array where each line has a decoded state for a given state
// given a transition sequence 1114 -> 34664, then
// [
//
//	{G2_achievable:true G2_achieved:false ... fail:false n:5 step:0 t:true}, // line 1114 as a decoded state map
//	{G2_achievable:true G2_achieved:false ... fail:false n:5 step:0 t:true} // line 34664 as a decoded state map
//
// ]
func (s *StateFile) stateSequence(header []string, transitionSequence []Transition) []map[string]string {
	stateSeq := []map[string]string{}
	for _, transition := range transitionSequence {
		itemMap := map[string]string{}
		// split line for transition.next in its commas then align header and states array
		states := strings.Split(s.StateMaps.LineToState[transition.next], ",")

		// header: ["G2_pursued", "G3_pursued", "G4_pursued", "G5_pursued", "G6_pursued", ...]
		// states: ["1", "1", "1", "0", "0", "0", ...]
		// itemMap: {G2_pursued: "1", G3_pursued: "1", G4_pursued: "1", G5_pursued: "0", ...}
		for i, headerName := range header {
			itemMap[headerName] = states[i]
		}
		stateSeq = append(stateSeq, itemMap)
	}
	return stateSeq
}

func printStateSequence(transitionSequence []Transition, sequence []map[string]string) {
	for i, transition := range transitionSequence {
		fmt.Println(transition.next, sequence[i])
	}
}

type PlanItem struct {
	GoalId  string
	Variant int
}

func (s *StateFile) PlanFromTransitionSequence(header []string, transitionSequence []Transition) []PlanItem {
	stateSeq := s.stateSequence(header, transitionSequence)
	// printStateSequence(transitionSequence, stateSeq)

	plan := []PlanItem{}
	for i, state := range stateSeq {
		// stop at line right before t == "false" for extracting planning
		// this is where the goalMgmt has ended its turn in prism model and where the planing is ready
		// to be read
		if i < len(stateSeq)-1 && stateSeq[i+1]["t"] == "false" {
			for _, headerName := range header {
				value := state[headerName]
				// variables become an array like
				// ["G2", "PURSUED"], ["n"]
				splittedKey := strings.Split(headerName, "_")
				if len(splittedKey) > 1 {
					// variables pursued with value != 0 are appended to the plan
					if splittedKey[1] == "pursued" && value != "0" {
						goalId := splittedKey[0]
						variant, err := strconv.Atoi(value)
						if err != nil {
							log.Fatal("Expected pursued value to be a number, goalId: ", goalId)
						}
						plan = append(plan, PlanItem{GoalId: goalId, Variant: variant})
					}
				}
			}
			break
		}
	}

	return plan
}
