package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	demo "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/events"
	"os"
	"sort"
	"strings"
)

func id(p *common.Player) string {
	if p == nil {
		return ""
	}
	return fmt.Sprint(p.SteamID64)
}
func weapon(w *common.Equipment) any {
	if w == nil {
		return nil
	}
	return map[string]any{"type": int(w.Type), "name": w.String(), "magazine": w.AmmoInMagazine(), "reserve": w.AmmoReserve()}
}

type fireSnapshot struct {
	Entity    int       `json:"entity"`
	Serial    int       `json:"serial"`
	Positions []float64 `json:"positions"`
}
type fireFrame struct {
	Tick  int            `json:"tick"`
	Fires []fireSnapshot `json:"fires"`
}

func main() {
	path := "../../fixtures/faze-vs-vitality-m2-dust2.dem"
	if len(os.Args) > 1 {
		path = os.Args[1]
	}
	f, e := os.Open(path)
	if e != nil {
		panic(e)
	}
	p := demo.NewParser(f)
	defer p.Close()
	ticks := map[int]bool{537: true, 5732: true, 5796: true, 6400: true, 7443: true, 7444: true, 7445: true, 7834: true, 8281: true, 6362: true, 6466: true, 6500: true, 13170: true, 30555: true, 31965: true, 69941: true}
	var projectileFrames []any
	var fireFrames []fireFrame
	var infernoFields []string
	var frames []any
	var records []any
	census := map[string]int{}
	round := 0
	record := func(kind string, d map[string]any) {
		census[kind]++
		d["kind"] = kind
		d["tick"] = p.GameState().IngameTick()
		d["round"] = round
		records = append(records, d)
	}
	p.RegisterEventHandler(func(e any) {
		kind := fmt.Sprintf("%T", e)
		d := map[string]any{}
		switch v := e.(type) {
		case events.RoundStart:
			round = p.GameState().TotalRoundsPlayed() + 1
			return
		case events.Kill:
			d = map[string]any{"killer": id(v.Killer), "victim": id(v.Victim), "assister": id(v.Assister), "weapon": weapon(v.Weapon), "headshot": v.IsHeadshot}
		case events.BombPlantBegin:
			d = map[string]any{"player": id(v.Player), "site": string(v.Site)}
		case events.BombPlanted:
			d = map[string]any{"player": id(v.Player), "site": string(v.Site), "position": p.GameState().Bomb().Position()}
		case events.BombDefused:
			d = map[string]any{"player": id(v.Player), "site": string(v.Site)}
		case events.BombExplode:
			d = map[string]any{"position": p.GameState().Bomb().Position()}
		case events.BombDropped:
			d = map[string]any{"player": id(v.Player), "entity": v.EntityID, "position": p.GameState().Bomb().Position()}
		case events.BombPickup:
			d = map[string]any{"player": id(v.Player)}
		case events.BombDefuseStart:
			d = map[string]any{"player": id(v.Player), "kit": v.HasKit}
		case events.BombDefuseAborted:
			d = map[string]any{"player": id(v.Player)}
		case events.BombPlantAborted:
			d = map[string]any{"player": id(v.Player)}
		case events.GrenadeEventIf:
			g := v.Base()
			d = map[string]any{"thrower": id(g.Thrower), "type": int(g.GrenadeType), "entity": g.GrenadeEntityID, "position": g.Position}
		case events.GrenadeProjectileThrow:
			g := v.Projectile
			d = map[string]any{"thrower": id(g.Thrower), "entity": g.Entity.ID(), "class": g.Entity.ServerClass().Name(), "weapon": weapon(g.WeaponInstance), "position": g.Position()}
		case events.GrenadeProjectileDestroy:
			g := v.Projectile
			d = map[string]any{"thrower": id(g.Thrower), "entity": g.Entity.ID(), "class": g.Entity.ServerClass().Name(), "weapon": weapon(g.WeaponInstance), "trajectory": g.Trajectory2}
		case events.GenericGameEvent:
			switch v.Name {
			case "player_death", "bomb_planted", "bomb_defused", "bomb_exploded", "flashbang_detonate", "hegrenade_detonate", "smokegrenade_detonate", "smokegrenade_expired", "inferno_startburn", "inferno_expire", "decoy_started", "decoy_expired":
				d = map[string]any{"name": v.Name, "data": v.Data}
			default:
				return
			}
		case events.PlayerFlashed:
			d = map[string]any{"player": id(v.Player), "attacker": id(v.Attacker), "durationSeconds": v.FlashDuration().Seconds()}
		case events.InfernoStart:
			if infernoFields == nil {
				for _, field := range v.Inferno.Entity.ServerClass().PropertyEntries() {
					if strings.HasPrefix(field, "m_fire") || strings.HasPrefix(field, "m_bFire") {
						infernoFields = append(infernoFields, field)
					}
				}
			}
			d = map[string]any{"thrower": id(v.Inferno.Thrower()), "fires": v.Inferno.Fires().List()}
		case events.InfernoExpired:
			d = map[string]any{"thrower": id(v.Inferno.Thrower()), "fires": v.Inferno.Fires().List()}
		default:
			return
		}
		record(kind, d)
	})
	p.RegisterEventHandler(func(e events.FrameDone) {
		tick := p.GameState().IngameTick()
		if round <= 4 {
			current := make([]fireSnapshot, 0)
			for entity, inferno := range p.GameState().Infernos() {
				positions := make([]float64, 0)
				for _, cell := range inferno.Fires().Active().List() {
					positions = append(positions, float64(float32(cell.X)), float64(float32(cell.Y)), float64(float32(cell.Z)))
				}
				if len(positions) > 0 {
					current = append(current, fireSnapshot{entity, inferno.Entity.SerialNum(), positions})
				}
			}
			sort.Slice(current, func(i, j int) bool { return current[i].Entity < current[j].Entity })
			if len(fireFrames) > 0 && fireFrames[len(fireFrames)-1].Tick == tick {
				fireFrames = fireFrames[:len(fireFrames)-1]
			}
			var previous []fireSnapshot
			if len(fireFrames) > 0 {
				previous = fireFrames[len(fireFrames)-1].Fires
			} else {
				previous = make([]fireSnapshot, 0)
			}
			now, _ := json.Marshal(current)
			before, _ := json.Marshal(previous)
			if !bytes.Equal(now, before) {
				fireFrames = append(fireFrames, fireFrame{tick, current})
			}
		}
		if tick >= 6362 && tick <= 6466 {
			for entity, g := range p.GameState().GrenadeProjectiles() {
				projectileFrames = append(projectileFrames, map[string]any{"tick": tick, "entity": entity, "position": g.Position(), "thrower": id(g.Thrower)})
			}
		}
		if !ticks[tick] {
			return
		}
		delete(ticks, tick)
		var players []map[string]any
		for _, v := range p.GameState().Participants().Playing() {
			if v.SteamID64 == 0 || v.IsBot {
				continue
			}
			var inventory []any
			for _, w := range v.Weapons() {
				inventory = append(inventory, weapon(w))
			}
			sort.Slice(inventory, func(i, j int) bool {
				return inventory[i].(map[string]any)["type"].(int) < inventory[j].(map[string]any)["type"].(int)
			})
			players = append(players, map[string]any{"steamId": id(v), "name": v.Name, "team": int(v.Team), "position": v.Position(), "health": v.Health(), "alive": v.IsAlive(), "yaw": v.ViewDirectionX(), "pitch": v.ViewDirectionY(), "armour": v.Armor(), "helmet": v.HasHelmet(), "money": v.Money(), "activeWeapon": weapon(v.ActiveWeapon()), "inventory": inventory, "flashbangCount": v.FlashbangCount(), "flashRemainingSeconds": v.FlashDurationTimeRemaining().Seconds()})
		}
		sort.Slice(players, func(i, j int) bool { return players[i]["steamId"].(string) < players[j]["steamId"].(string) })
		frames = append(frames, map[string]any{"tick": tick, "players": players, "bomb": map[string]any{"carrier": id(p.GameState().Bomb().Carrier), "position": p.GameState().Bomb().Position()}})
	})
	if e = p.ParseToEnd(); e != nil {
		panic(e)
	}
	json.NewEncoder(os.Stdout).Encode(map[string]any{"parser": "demoinfocs 4.5.1", "frames": frames, "projectileFrames": projectileFrames, "fireFrames": fireFrames, "infernoFields": infernoFields, "events": records, "census": census})
	fmt.Fprintf(os.Stderr, "frames=%d events=%d census=%v\n", len(frames), len(records), census)
}
