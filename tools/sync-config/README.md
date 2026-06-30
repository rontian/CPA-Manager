# sync-config

Standalone env sync helper for production hosts where Python, make, and Go may be unavailable.

Run from the repository root:

```bash
./tools/sync-config-linux-amd64 --skip-yaml --dry-run
./tools/sync-config-linux-amd64 --skip-yaml
```

Use the matching binary in `tools/` for the host platform, for example `sync-config-linux-arm64`, `sync-config-darwin-arm64`, or `sync-config-windows-amd64.exe`.

The tool only copies missing files or appends missing `.env` keys from `.env.example`. Existing values are not overwritten.

Development fallback:

```bash
cd tools/sync-config
go test ./...
go run . --skip-yaml --env ../../.env --env-example ../../.env.example --dry-run
```
