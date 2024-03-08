package prism

import (
	"bufio"
	"os"
	"strings"
)

type StateFile struct {
	Header     string
	StateLines map[string]string
}

func transformStateLineInMap(stateLines []string) map[string]string {
	stateMap := map[string]string{}
	for _, line := range stateLines {
		splittedLine := strings.Split(line, ":")
		lineNumber, state := splittedLine[0], splittedLine[1]
		stateMap[state] = lineNumber
	}
	return stateMap
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
		Header:     header,
		StateLines: transformStateLineInMap(stateLines),
	}, nil
}
