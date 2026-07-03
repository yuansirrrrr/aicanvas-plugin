# AI-CanvasPro OpenCode Plugin

This repository is an OpenCode plugin that bundles the AI-CanvasPro canvas runtime. OpenCode acts as the agent and calls canvas tools directly; AI-CanvasPro provides the local canvas service and command bridge.

## Requirements

- OpenCode with plugin support
- The modified OpenChamber build that supports `/aicanvas`
- Python 3.10 or newer installed on the user's machine
- Git

This plugin does not bundle Python or commit a `.venv` directory. Each user must install Python locally first. On Windows, install Python from python.org or the Microsoft Store and make sure `python` is available in PowerShell:

```powershell
python --version
```

On macOS/Linux, make sure `python3` is available:

```bash
python3 --version
```

## Install

Clone this repository into the OpenCode plugin directory. The recommended folder name is `ai-canvaspro`:

```bash
mkdir -p ~/.config/opencode/plugins
cd ~/.config/opencode/plugins
git clone https://github.com/yuansirrrrr/ai-canvaspro-plugin ai-canvaspro
```

On Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.config\opencode\plugins"
cd "$env:USERPROFILE\.config\opencode\plugins"
git clone https://github.com/yuansirrrrr/ai-canvaspro-plugin ai-canvaspro
```

If you clone without the final `ai-canvaspro` argument, Git will create `ai-canvaspro-plugin`. That layout is also supported; use that folder name in the commands below and in `opencode.json`.

Install runtime dependencies. The installer creates a local virtual environment under `runtime/.venv` on this machine:

```powershell
cd "$env:USERPROFILE\.config\opencode\plugins\ai-canvaspro"
.\scripts\install-runtime.ps1
```

macOS/Linux:

```bash
cd ~/.config/opencode/plugins/ai-canvaspro
chmod +x scripts/install-runtime.sh
./scripts/install-runtime.sh
```

## Enable In OpenCode

Cloning into `plugins` does not guarantee automatic loading. Enable the plugin in `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "./plugins/ai-canvaspro/ai-canvaspro.js"
  ]
}
```

The relative path is resolved from `~/.config/opencode`.
If your folder is `ai-canvaspro-plugin`, configure:

```json
{
  "plugin": [
    "./plugins/ai-canvaspro-plugin/ai-canvaspro.js"
  ]
}
```

## Use

Start OpenChamber and type:

```text
/aicanvas
```

OpenChamber will locate the configured plugin, or fall back to the installed plugin under `~/.config/opencode/plugins`, start `runtime/server.py`, and open the canvas in the built-in browser at:

```text
http://127.0.0.1:8777/
```

To stop the local canvas service from OpenChamber:

```text
/aicanvas-stop
```

After the page loads, OpenCode tools can read context and operate the canvas:

- `ai_canvaspro`
- `aicanvas_stop`
- `aicanvas_get_context`
- `aicanvas_list_commands`
- `aicanvas_list_skills`
- `aicanvas_create_node`
- `aicanvas_set_prompt`
- `aicanvas_set_params`
- `aicanvas_connect_nodes`
- `aicanvas_arrange_nodes`
- `aicanvas_align_nodes`
- `aicanvas_run_generation`
- `aicanvas_call_command`

High-risk commands such as generation require explicit confirmation through the tool argument `confirmed=true`.

## Verify

Health endpoint:

```text
http://127.0.0.1:8777/api/v2/opencode-canvas/health
```

Commands endpoint:

```text
http://127.0.0.1:8777/api/v2/opencode-canvas/commands
```

Skills endpoint:

```text
http://127.0.0.1:8777/api/v2/opencode-canvas/skills
```

## Notes

The old AI-CanvasPro README was moved to `runtime/README.runtime.md`.

The first plugin version may keep local user data under `runtime/user/`. Back it up before deleting or recloning the plugin directory.
