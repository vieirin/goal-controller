package data

type Element struct {
	ID               string `json:"id"`
	Text             string `json:"text"`
	Type             string `json:"type"`
	X                int    `json:"x"`
	Y                int    `json:"y"`
	CustomProperties struct {
		Description string `json:"Description"`
		Root        string `json:"root"`
		Utility     string `json:"utility"`
		Cost        string `json:"cost"`
		Alt         string `json:"alt"`
		DependsOn   string `json:"dependsOn"`
	} `json:"customProperties,omitempty"`
}
type Link struct {
	ID     string `json:"id"`
	Type   string `json:"type"`
	Source string `json:"source"`
	Target string `json:"target"`
}

type Actor struct {
	Element
	Nodes []Element `json:"nodes"`
}

type GoalModel struct {
	Actors       []Actor   `json:"actors"`
	Orphans      []Element `json:"orphans"`
	Dependencies []Element `json:"dependencies"`
	Links        []Link    `json:"links"`
	Display      map[string]struct {
		Width    float64 `json:"width"`
		Height   float64 `json:"height"`
		Vertices []struct {
			X int `json:"x"`
			Y int `json:"y"`
		} `json:"vertices,omitEmpty"`
	} `json:"display"`
	Tool    string `json:"tool"`
	Istar   string `json:"istar"`
	Diagram struct {
		Width            int `json:"width"`
		Height           int `json:"height"`
		CustomProperties struct {
			Description string `json:"Description"`
			Utility     string `json:"utility"`
			Cost        string `json:"cost"`
		} `json:"customProperties"`
	} `json:"diagram"`
}
