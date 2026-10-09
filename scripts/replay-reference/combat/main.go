// Emits damage and kill assist events from demoinfocs as an independent combat oracle.
package main

import (
	"encoding/json"
	"fmt"
	"os"

	demo "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/events"
)

func id(p *common.Player) string {
	if p == nil {
		return ""
	}
	return fmt.Sprint(p.SteamID64)
}

func main() {
	file, err := os.Open(os.Args[1])
	if err != nil {
		panic(err)
	}
	defer file.Close()
	parser := demo.NewParser(file)
	defer parser.Close()
	damage, kills := []map[string]any{}, []map[string]any{}
	parser.RegisterEventHandler(func(e events.PlayerHurt) {
		damage = append(damage, map[string]any{
			"tick": parser.GameState().IngameTick(), "victim": id(e.Player), "attacker": id(e.Attacker),
			"health": e.HealthDamage, "armour": e.ArmorDamage, "remaining": e.Health, "hitgroup": int(e.HitGroup),
		})
	})
	parser.RegisterEventHandler(func(e events.Kill) {
		kills = append(kills, map[string]any{
			"tick": parser.GameState().IngameTick(), "victim": id(e.Victim), "assister": id(e.Assister), "flashAssist": e.AssistedFlash,
		})
	})
	if err := parser.ParseToEnd(); err != nil {
		panic(err)
	}
	json.NewEncoder(os.Stdout).Encode(map[string]any{"damage": damage, "kills": kills})
}
