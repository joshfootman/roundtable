package main

import (
	"encoding/json"
	"fmt"
	demo "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/events"
	"os"
	"sort"
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
			d = map[string]any{"thrower": id(g.Thrower), "entity": g.Entity.ID(), "weapon": weapon(g.WeaponInstance), "position": g.Position()}
		case events.GrenadeProjectileDestroy:
			g := v.Projectile
			d = map[string]any{"thrower": id(g.Thrower), "entity": g.Entity.ID(), "weapon": weapon(g.WeaponInstance), "trajectory": g.Trajectory2}
		case events.PlayerFlashed:
			d = map[string]any{"player": id(v.Player), "attacker": id(v.Attacker), "durationSeconds": v.FlashDuration().Seconds()}
		case events.InfernoStart:
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
	json.NewEncoder(os.Stdout).Encode(map[string]any{"parser": "demoinfocs 4.5.1", "frames": frames, "projectileFrames": projectileFrames, "events": records, "census": census})
	fmt.Fprintf(os.Stderr, "frames=%d events=%d census=%v\n", len(frames), len(records), census)
}
