package state

import "os"

func ProcessStateFile(path string) (int, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err

	}
	b1 := make([]byte, 5)
	n1, err := f.Read(b1)
}
