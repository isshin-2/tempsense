# tempsense_ota

OTA delivery branch for TEMPSENSE firmware updates.

## Files

| File | Purpose |
|---|---|
| `version.json` | Current firmware version + download URL |
| `firmware.bin` | Compiled firmware binary (pushed by companion app) |
| `companion/` | OTA build & deploy tool (Node.js web app) |

## How updates reach the device

The TEMPSENSE node checks `version.json` on every WiFi connect.
If the version differs, it downloads `firmware.bin` and flashes itself.

→ See [companion/README.md](companion/README.md) for how to deploy updates.
