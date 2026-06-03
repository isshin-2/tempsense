# 🖥️ TEMPSENSE Companion App

**OTA Build & Deploy Tool** — compile firmware and push updates to GitHub in one click.

---

## What it does

| Step | Action |
|---|---|
| 🔨 **Build** | Runs PlatformIO to compile `src/main.cpp` into `firmware.bin` |
| ⬆️ **Upload** | Pushes `firmware.bin` + `version.json` to the `tempsense_ota` GitHub branch |
| 🚀 **Build & Upload** | Both in sequence — the normal workflow |

The TEMPSENSE device checks for updates on every boot. As soon as the new files are on GitHub, the next device reboot triggers an automatic OTA flash.

---

## Prerequisites

| Requirement | Install |
|---|---|
| **Node.js** v18+ | [nodejs.org](https://nodejs.org) |
| **PlatformIO CLI** | `pip install platformio` |
| **GitHub PAT** | See below |

---

## Setup

### 1. Get a GitHub Personal Access Token

1. Go to **github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token (classic)**
3. Name: `TEMPSENSE OTA`
4. Scope: ✅ `repo` (entire section)
5. Click **Generate token** — copy it immediately

### 2. Configure the app

Create a `.env` file in this folder (already exists if you cloned the full repo):

```env
GITHUB_TOKEN=ghp_your_token_here
GITHUB_REPO=isshin-2/tempsense
GITHUB_BRANCH=tempsense_ota
FIRMWARE_DIR=C:\Users\YourName\Documents\Arduino\TEMPSENSE
PORT=3000
```

> ⚠️ **Never commit `.env` to git** — it contains your secret token.
> It is already listed in `.gitignore`.

### 3. Run and Setup in One Click 🚀

Simply double-click the `run.bat` file in this folder. It will:
- Automatically check and install dependencies (`npm install`) if they are missing
- Launch the companion server backend
- Automatically open the dashboard in your default browser at **http://localhost:3000** (or the PORT configured in `.env`)

Alternatively, you can run it manually:

```powershell
npm install
npm start
```

---

## Step-by-Step: Deploy a Firmware Update

### Step 1 — Edit the firmware

Open [`src/main.cpp`](../src/main.cpp) and make your changes.

### Step 2 — Bump the version

Find near the top of `main.cpp`:

```cpp
static const char* FW_VERSION = "1.0.1";
```

Change to the next version (e.g. `"1.0.2"`).

### Step 3 — Open the companion app

Go to **[http://localhost:3000](http://localhost:3000)**

Set the **Version tag** field to match (e.g. `1.0.2`).

### Step 4 — Click 🚀 Build & Upload

The pipeline runs:
```
🔨 Build  ›  ⬆️ Upload  ›  ✅ Live
```

Watch the **Build Log** terminal for real-time output.

### Step 5 — Reboot the device

Power-cycle or briefly press BOOT on the XIAO.

The TFT will show:
```
Checking for updates...
Current: v1.0.1
Online:  v1.0.2
New firmware — updating...
```

Then it flashes and reboots automatically into the new version.

---

## UI Reference

### Repository Info card
Shows the configured GitHub repo, OTA branch, and local firmware directory.

### Binary Status card
| Field | Meaning |
|---|---|
| `firmware.bin` | Ready ✓ = binary exists and can be uploaded |
| `Size` | Compiled firmware size in KB |
| `Last Build` | Timestamp of the most recent successful build |

### Build & Deploy card
| Control | Description |
|---|---|
| **Version tag** | Must match `FW_VERSION` in `main.cpp` exactly |
| 🔨 **Build Only** | Compile — check for errors before uploading |
| ⬆️ **Upload Only** | Push existing binary — useful if build already done |
| 🚀 **Build & Upload** | Normal workflow |

### Step indicator
```
🔨 Build  ›  ⬆️ Upload  ›  ✅ Live
```
- Grey = not started
- Blue (active) = running
- Green (done) = success
- Red (failed) = error — check the log

### Build Log terminal
Streams raw PlatformIO output in real time.  
Look for `[SUCCESS]` at the bottom to confirm build passed.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `"pio" not found` | The app auto-falls back to `python -m platformio`. Ensure PlatformIO is installed: `pip install platformio` |
| Build fails | Check the log for compile errors. Fix in `main.cpp` and try again. |
| Upload fails with 401 | Your GitHub token is expired or incorrect. Generate a new one and update `.env`. |
| Upload fails with 404 | Repo or branch name in `.env` is wrong. Check `GITHUB_REPO` and `GITHUB_BRANCH`. |
| Device doesn't update | Confirm `FW_VERSION` in `main.cpp` matches the version tag you uploaded. They must be different from the currently flashed version. |

---

## File Structure

```
companion/
├── server.js          Express backend (build + GitHub API upload)
├── package.json       Node dependencies
├── .env               🔑 Your GitHub token (NOT committed)
├── .gitignore         Excludes .env and node_modules
├── README.md          This file
└── public/
    └── index.html     Web UI (dark theme, real-time log streaming)
```
