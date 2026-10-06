package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"

	demo "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/events"
)

type item struct {
	Entity     int     `json:"entity"`
	Serial     int     `json:"serial"`
	Definition int     `json:"definition"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Z          float64 `json:"z"`
}
type sample struct {
	Tick  int    `json:"tick"`
	Items []item `json:"items"`
}

func main() {
	path := "../../fixtures/local/faze-vs-vitality-m2-dust2.dem"
	if len(os.Args) > 1 {
		path = os.Args[1]
	}
	file, err := os.Open(path)
	if err != nil {
		panic(err)
	}
	defer file.Close()
	parser := demo.NewParser(file)
	defer parser.Close()
	ticks := map[int]bool{5796: true, 6400: true, 6492: true, 7443: true, 7834: true, 8281: true, 13170: true, 30555: true, 31965: true}
	frames := map[int]sample{}
	parser.RegisterEventHandler(func(events.FrameDone) {
		tick := parser.GameState().IngameTick()
		if !ticks[tick] {
			return
		}
		items := make([]item, 0)
		for entity, equipment := range parser.GameState().Weapons() {
			if equipment.Owner != nil || equipment.Entity == nil {
				continue
			}
			definition := int(equipment.Entity.PropertyValueMust("m_iItemDefinitionIndex").S2UInt64())
			if definition == 49 || definition == 41 || definition == 42 || definition == 59 || definition >= 500 {
				continue
			}
			position := equipment.Entity.Position()
			items = append(items, item{entity, equipment.Entity.SerialNum(), definition, position.X, position.Y, position.Z})
		}
		sort.Slice(items, func(i, j int) bool { return items[i].Entity < items[j].Entity })
		frames[tick] = sample{tick, items}
	})
	for parser.GameState().IngameTick() <= 31965 {
		more, err := parser.ParseNextFrame()
		if err != nil {
			panic(err)
		}
		if !more {
			break
		}
	}
	out := make([]sample, 0, len(frames))
	for _, frame := range frames {
		out = append(out, frame)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Tick < out[j].Tick })
	data, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		panic(err)
	}
	fmt.Println(string(data))
}
