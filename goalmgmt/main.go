package main

import (
	"fmt"
	"log"

	"github.com/vieirin/goal-controller/goalmgmt/goalModel"
)

func main() {
	modelTree := goalModel.Digest("../examples/edgeModel.txt")
	if modelTree == nil {
		log.Fatal("Could not load model")
		return
	}
	goals := modelTree.SequenceGoals()
	fmt.Println(goals)
	return
}
