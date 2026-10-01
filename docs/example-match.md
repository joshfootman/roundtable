# Example match

The example contains all 23 competitive rounds from FaZe versus Vitality on Dust II at BLAST Premier Spring Final 2024. The source match is linked in `public/example/manifest.json`. The original demo remains in the ignored `fixtures/local` directory.

Run `npm run generate:example` to regenerate the shipped assets from that local demo. Pass another path after `--` when the recording is stored elsewhere. Run `npm run verify:example` to compare every shipped round boundary, death and planted bomb position against the committed independent Go parser reference.

The versioned manifest records source SHA-256, metadata and each round's compressed size, decoded size and decoded SHA-256. Each gzip file contains an RPL1 binary record. A UTF-8 JSON header stores events, player inspection and track dimensions. Four-byte-aligned raw typed arrays store player movement and grenade trajectories. Tracks remain typed arrays in the browser. The loader validates the manifest, checksum, dimensions and ordered ticks before publishing a round.

Loading is progressive. Metadata appears first, then completed rounds arrive sequentially through the same import events as a local recording. Users can replay the first round while later rounds load, cancel the download, or replace it with a local demo. Completed rounds remain available after a failed download.

The public directory is served by Vite and copied into the static production build. The example requires no upload or server-side parsing. Its files are already gzip compressed, so hosts should serve the `.rpl` bytes as files without adding a `Content-Encoding: gzip` header. That header would ask the browser to decompress the file before the replay loader receives it.
