# Local demo fixtures

The current example demo is `faze-vs-vitality-m2-dust2.dem`.

- Match: FaZe vs Vitality, map 2, Dust2.
- Event: BLAST Premier Spring Final 2024, as identified by the supplied archive filename.
- Source: user-supplied `blast-premier-spring-final-2024-faze-vs-vitality-bo3.rar`, extracted from Downloads.
- Copied into this directory on 2026-09-28; the original remains in Downloads.
- Size: 598,102,502 bytes (about 570 MiB).
- SHA-256: `0d5a5f00301ea55780f30184b9e257b9d0e742fb5d3e6b4c70878340be6eb7d4`.

Raw `.dem` files in this directory are ignored by Git. A fresh checkout will
need a local copy of the fixture; CI must not assume it is present. This file is
for local development and example preparation, and is not served by Vite or
included in the app bundle. Public example delivery will be decided after the
pre-parsed versus live-parsing benchmarks described in `docs/PROJECT.md`.

## Verified metadata

The [HLTV match page](https://www.hltv.org/matches/2372742/faze-vs-vitality-blast-premier-spring-final-2024)
identifies map 2 as Dust2, played on 14 June 2024, with FaZe losing 10–13 to
Vitality. The demo header independently identifies `de_dust2` and the server
`BLAST Premier 2024`. Teams, score, date and competitive round count are not
present in this demo's header or file-info record. The app does not infer them
from the filename.

The following values were independently decoded with `protoc` on 28 September
2026, independently of the custom TypeScript parser.

| Record      | Field                 | Value                                  |
| ----------- | --------------------- | -------------------------------------- |
| Container   | Signature             | `PBDEMS2\0`                            |
| Container   | File-info offset      | `598102484`                            |
| File header | `patch_version`       | `14011`                                |
| File header | `server_name`         | `BLAST Premier 2024`                   |
| File header | `client_name`         | `SourceTV Demo`                        |
| File header | `map_name`            | `de_dust2`                             |
| File header | `game_directory`      | `/home/csserver001/cs2/game/csgo`      |
| File header | `fullpackets_version` | `2`                                    |
| File header | `demo_version_name`   | `valve_demo_2`                         |
| File header | `demo_version_guid`   | `8e9d71ab-04a1-4c01-bb61-acfede27c046` |
| File header | `build_num`           | `10072`                                |
| File header | `server_start_tick`   | `42184`                                |
| File info   | `playback_time`       | `3078.25` seconds                      |
| File info   | `playback_ticks`      | `197008`                               |
| File info   | `playback_frames`     | `197003`                               |
| File info   | `game_info`           | Absent                                 |

`playback_time` describes the recording, including time outside competitive
rounds. It is not the competitive match duration. Dividing ticks by seconds
gives 64 for this recording, but the header does not declare a tick rate.

The 16-byte container has separate 32-bit words at offsets 8 and 12. Treating
them as one 64-bit file-info offset would be incorrect for this fixture. The
first frame begins at byte 16. Its framing is `01 ff ff ff ff 0f 9e 01`, followed
by the 158-byte `CDemoFileHeader` payload at bytes 24 through 181. The frame at
byte 598102484 is `02 90 83 0c 0d`, followed by a 13-byte `CDemoFileInfo` payload.
Both records are uncompressed.

The oracle uses the self-contained
[upstream demo schema](https://github.com/SteamTracking/Protobufs/blob/f697fbf83cfa0f4dad1142136f53ac5752fd5a82/csgo/demo.proto).
The older snapshot commit mentioned in `docs/PROJECT.md` was not retrievable
from that repository during this verification. This slice pins the retrieved
schema instead.

To repeat the independent decode, extract only the original protobuf payloads
and pass them to `protoc`. Run these commands from the repository root with
Python 3 and `protoc` installed.

```sh
python3 - <<'PY'
from pathlib import Path
import struct

with Path('fixtures/local/faze-vs-vitality-m2-dust2.dem').open('rb') as demo:
    prefix = demo.read(182)
    info_offset = struct.unpack_from('<I', prefix, 8)[0]
    demo.seek(info_offset + 5)
    info = demo.read(13)
Path('/tmp/roundtable-header.pb').write_bytes(prefix[24:182])
Path('/tmp/roundtable-info.pb').write_bytes(info)
PY
protoc --proto_path=schemas --decode=CDemoFileHeader schemas/demo.proto < /tmp/roundtable-header.pb
protoc --proto_path=schemas --decode=CDemoFileInfo schemas/demo.proto < /tmp/roundtable-info.pb
```

These extraction offsets describe this exact fixture. They are independent
oracle inputs, not an alternative general-purpose demo parser.

## Small fixtures for CI

The tracked files in `fixtures/metadata/` preserve the original metadata bytes.

- `header-record.bin` is the 166-byte command at original offset 16.
- `file-info-record.bin` is the 18-byte command at original offset 598102484.
- `dust2-metadata.bin` is a 200-byte test container. It concatenates a 16-byte
  container header and those two unchanged records. The file-info offset is
  relocated to 182 and the unused spawn-groups offset is zero.

The small container contains no gameplay and is not a playable demo. Metadata
unit tests use it without requiring the large local fixture. The full demo
remains the local integration check.

Run `npm run verify:demo` to check the full local fixture through the production
Effect parser and report its read count and byte budget. The command fails if
the fixture is missing or its metadata differs from the verified values.
Run `DEMO_PATH=fixtures/local/faze-vs-vitality-m2-dust2.dem npm run test:e2e` to exercise
the complete file through the browser input and worker. Without `DEMO_PATH`, Playwright uses the roster container below.
Metadata unit tests continue to use the small metadata container.
Run `npm run verify:roster` to check all ten player names and exact Steam IDs
against the independent oracle and report bounded reads from the full demo.

## Small roster fixture for CI

`fixtures/roster/import.dem` is a 45,196-byte sparse test container extracted on
30 September 2026 from the full demo above. Its SHA-256 is
`3013628628ab8a000a4e1fbd3ead0d9631f50a01b1a32c4ec308afd3883cbd26`.
The source SHA-256 was checked again during extraction:
`0d5a5f00301ea55780f30184b9e257b9d0e742fb5d3e6b4c70878340be6eb7d4`.

The fixture concatenates these unchanged, complete source records in their
original order. Length includes the command, tick and payload-length varints.
Commands with bit 64 set retain their original Snappy compression.

| Record                                      | Source offset | Fixture offset |       Tick | Command | Record bytes |
| ------------------------------------------- | ------------: | -------------: | ---------: | ------: | -----------: |
| File header                                 |            16 |             16 | 4294967295 |       1 |          166 |
| String tables                               |         71955 |            182 | 4294967295 |      70 |        16860 |
| Event descriptors in signon packet          |         88829 |          17042 | 4294967295 |      72 |         8505 |
| Ten player spawn events in packet           |       1565604 |          25547 |        449 |      71 |        17496 |
| Freeze-end and match-start events in packet |      13335298 |          43043 |       5732 |      71 |         2135 |
| File info                                   |     598102484 |          45178 |     197008 |       2 |           18 |

Only the 16-byte container changes: its file-info offset becomes 45178 and its
unused spawn-groups word becomes zero. Gameplay records and protobuf payloads
are not rewritten. This is a parser test input, not a playable or complete demo.
Its playback metadata continues to describe the original recording.

The initial `userinfo` table contains twelve human identities and two SourceTV
clients. `zw1nc3k` and `COPPET` are spectators. The ten competitors emit
`player_spawn` events before the first `round_freeze_end`; that event provides a
natural completion boundary without assuming ten players or particular slots.
The same boundary packet contains `round_announce_match_start`. The fixture
preserves the corresponding real event descriptors and complete packets.
`userinfo` alone does not establish competitive participation or team labels.

As an independent oracle, `github.com/markus-wa/demoinfocs-golang/v4@v4.5.1`
parsed the full source demo through frame 100. Its participant state reported
these ten Steam IDs on teams 2 or 3, the two spectators on team 1, and both
SourceTV clients as bots on team 0. These IDs also match the ten actual spawn
user IDs in the retained packet. Keep Steam IDs as decimal strings because
JavaScript numbers cannot represent them exactly.

| Name     | Steam ID          | Spawn user ID |
| -------- | ----------------- | ------------: |
| broky    | 76561198201620490 |             6 |
| ropz     | 76561197991272318 |             7 |
| frozen   | 76561198068422762 |             8 |
| mezii    | 76561197973140692 |             9 |
| rain     | 76561197997351207 |            10 |
| flameZ   | 76561197978835160 |            11 |
| apEX     | 76561197989744167 |            12 |
| ZywOo    | 76561198113666193 |            13 |
| Spinx    | 76561198063336407 |            14 |
| karrigan | 76561197989430253 |            15 |

The compact first-round fixture and independent coordinate samples are documented in [replay/README.md](replay/README.md).

## Additional map recordings

Full recordings covering the ten-map inventory are stored in ignored `fixtures/local/`.
See [map coverage](../docs/map-coverage.md) for acquisition sources, parser failures,
calibration work and the local inspection command. [maps.json](maps.json) records
file sizes and hashes; a fresh checkout must obtain the recordings separately.
