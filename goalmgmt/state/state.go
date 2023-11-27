package state

import "os"

func ProcessStateFile(path string) (int, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, err

	}
	b1 := make([]byte, 5)
	return f.Read(b1)
}
