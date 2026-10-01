package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"slices"
	"sort"
	"strconv"
	"strings"

	demo "github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/events"
	"github.com/markus-wa/demoinfocs-golang/v5/pkg/demoinfocs/msg"
)

type player struct {
	SteamID string  `json:"steamId"`
	Name    string  `json:"name"`
	Team    int     `json:"team"`
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	Z       float64 `json:"z"`
	Yaw     float32 `json:"yaw"`
}

type sample struct {
	Tick    int      `json:"tick"`
	Players []player `json:"players"`
}

type round struct {
	Number        int     `json:"number"`
	Overtime      int     `json:"overtime"`
	StartTick     int     `json:"startTick"`
	LiveStartTick int     `json:"liveStartTick"`
	ResultTick    int     `json:"resultTick"`
	EndTick       int     `json:"endTick"`
	Winner        int     `json:"winner"`
	Start         *sample `json:"start,omitempty"`
	Live          *sample `json:"live,omitempty"`
}

type plant struct {
	Round int     `json:"round"`
	Tick  int     `json:"tick"`
	Site  string  `json:"site"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Z     float64 `json:"z"`
}

type death struct {
	Round  int    `json:"round"`
	Tick   int    `json:"tick"`
	Victim string `json:"victim"`
	Killer string `json:"killer"`
	World  bool   `json:"world"`
}

type report struct {
	MapName           string   `json:"mapName"`
	Rounds            []round  `json:"rounds"`
	Plants            []plant  `json:"plants"`
	Deaths            []death  `json:"deaths"`
	Samples           []sample `json:"samples"`
	FinalTick         int      `json:"finalTick"`
	TotalRoundsPlayed int      `json:"totalRoundsPlayed"`
}

func run() error {
	tickFlag := flag.String("ticks", "", "comma-separated exact in-game sample ticks")
	flag.Parse()
	if flag.NArg() != 1 {
		return fmt.Errorf("usage: go run ./maps [-ticks 100,200] recording.dem")
	}
	wanted := map[int]bool{}
	for _, value := range strings.Split(*tickFlag, ",") {
		if value == "" {
			continue
		}
		tick, err := strconv.Atoi(value)
		if err != nil || tick < 0 {
			return fmt.Errorf("invalid sample tick %q", value)
		}
		wanted[tick] = true
	}
	f, err := os.Open(flag.Arg(0))
	if err != nil {
		return err
	}
	defer f.Close()
	p := demo.NewParser(f)
	defer p.Close()
	out := report{Rounds: []round{}, Plants: []plant{}, Deaths: []death{}, Samples: []sample{}}
	p.RegisterNetMessageHandler(func(header *msg.CDemoFileHeader) { out.MapName = header.GetMapName() })
	var current *round
	capture := func() sample {
		result := sample{Tick: p.GameState().IngameTick(), Players: []player{}}
		for _, value := range p.GameState().Participants().Playing() {
			if value.SteamID64 == 0 || value.IsBot {
				continue
			}
			position := value.Position()
			result.Players = append(result.Players, player{SteamID: strconv.FormatUint(value.SteamID64, 10), Name: value.Name, Team: int(value.Team), X: position.X, Y: position.Y, Z: position.Z, Yaw: value.ViewDirectionX()})
		}
		sort.Slice(result.Players, func(i, j int) bool { return result.Players[i].SteamID < result.Players[j].SteamID })
		return result
	}
	finish := func(tick int) {
		if current != nil && current.ResultTick != 0 {
			current.EndTick = tick
			out.Rounds = append(out.Rounds, *current)
		}
		current = nil
	}
	p.RegisterEventHandler(func(events.RoundStart) {
		state := p.GameState()
		if state.IsWarmupPeriod() || !state.IsMatchStarted() {
			current = nil
			return
		}
		finish(state.IngameTick())
		current = &round{Number: state.TotalRoundsPlayed() + 1, Overtime: state.OvertimeCount(), StartTick: state.IngameTick()}
	})
	p.RegisterEventHandler(func(events.RoundFreezetimeEnd) {
		if current != nil && current.LiveStartTick == 0 {
			current.LiveStartTick = p.GameState().IngameTick()
		}
	})
	p.RegisterEventHandler(func(value events.RoundEnd) {
		if value.Reason == events.RoundEndReasonGameStart {
			current = nil
			return
		}
		if current != nil {
			current.ResultTick = p.GameState().IngameTick()
			current.Winner = int(value.Winner)
		}
	})
	p.RegisterEventHandler(func(value events.BombPlanted) {
		if current == nil {
			return
		}
		position := p.GameState().Bomb().Position()
		out.Plants = append(out.Plants, plant{Round: current.Number, Tick: p.GameState().IngameTick(), Site: string(value.Site), X: position.X, Y: position.Y, Z: position.Z})
	})
	p.RegisterEventHandler(func(value events.Kill) {
		if current == nil || value.Victim == nil {
			return
		}
		killer := ""
		if value.Killer != nil {
			killer = strconv.FormatUint(value.Killer.SteamID64, 10)
		}
		out.Deaths = append(out.Deaths, death{Round: current.Number, Tick: p.GameState().IngameTick(), Victim: strconv.FormatUint(value.Victim.SteamID64, 10), Killer: killer, World: value.Killer == nil})
	})
	p.RegisterEventHandler(func(events.FrameDone) {
		tick := p.GameState().IngameTick()
		out.FinalTick = tick
		if wanted[tick] {
			out.Samples = append(out.Samples, capture())
			delete(wanted, tick)
		}
		if current != nil && len(out.Rounds) == 0 {
			if current.Start == nil {
				value := capture()
				current.Start = &value
			}
			if current.LiveStartTick != 0 && current.Live == nil {
				value := capture()
				current.Live = &value
			}
		}
	})
	if err := p.ParseToEnd(); err != nil {
		return err
	}
	finish(out.FinalTick)
	out.TotalRoundsPlayed = p.GameState().TotalRoundsPlayed()
	accepted := make(map[int]round, len(out.Rounds))
	for _, value := range out.Rounds {
		accepted[value.Number] = value
	}
	belongs := func(number, tick int) bool {
		value, exists := accepted[number]
		return exists && tick >= value.StartTick && tick < value.EndTick
	}
	out.Deaths = slices.DeleteFunc(out.Deaths, func(value death) bool {
		return !belongs(value.Round, value.Tick)
	})
	out.Plants = slices.DeleteFunc(out.Plants, func(value plant) bool {
		return !belongs(value.Round, value.Tick)
	})
	if len(wanted) != 0 {
		return fmt.Errorf("requested ticks were absent: %v", wanted)
	}
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(out)
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
