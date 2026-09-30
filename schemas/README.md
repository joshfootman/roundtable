# Demo protocol

`demo.proto` is the self-contained upstream CS2 schema from [SteamTracking/Protobufs](https://github.com/SteamTracking/Protobufs/blob/f697fbf83cfa0f4dad1142136f53ac5752fd5a82/csgo/demo.proto), pinned to its last file change at commit `f697fbf83cfa0f4dad1142136f53ac5752fd5a82`.

Run `npm run generate:proto` to regenerate the TypeScript descriptors. The import decodes metadata, demo string tables and game-event packets.

`roster.proto` contains only `CMsgPlayerInfo`, the legacy event/list messages and their two network IDs from `csgo/networkbasetypes.proto` and `csgo/gameevents.proto` at snapshot commit `14db58bad6e6ac2cb794b441c7b3d0d2a6dd1752` of [SteamTracking/Protobufs](https://github.com/SteamTracking/Protobufs/tree/14db58bad6e6ac2cb794b441c7b3d0d2a6dd1752/csgo). Field numbers and types are preserved; the unrelated custom maximum-size option and imports are omitted so this subset compiles without the upstream dependency tree.

`replay.proto` contains the server-info, entity-update, string-table and flattened
serializer messages from the schemas bundled with demoinfocs-golang v4.5.1. Field
numbers and types are preserved; custom size options and unrelated imports are omitted.
The custom inner bit decoder and its attribution live in `src/demo/entities`.

The replay subset also preserves origin, angles, pawn handle and item definition
from `CMsgTEFireBullets` in the same pinned reference. Its network ID is 452.
Unrelated sound, spread and rendering fields are consumed by protobuf decoding
and omitted from this projection.
