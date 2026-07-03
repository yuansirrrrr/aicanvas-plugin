# Troubleshooting

## OpenCode does not load the plugin

Cloning into `~/.config/opencode/plugins` is only installation. Enable the plugin explicitly in `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "./plugins/ai-canvaspro/ai-canvaspro.js"
  ]
}
```

Restart OpenCode or OpenChamber after changing the config.

## `/aicanvas` cannot find `server.py`

Check that the repository was cloned under the OpenCode plugin directory:

```text
~/.config/opencode/plugins/ai-canvaspro
```

or, if you used Git's default folder name:

```text
~/.config/opencode/plugins/ai-canvaspro-plugin
```

and that this file exists in that folder:

```text
runtime/server.py
```

## Bridge health is not ready

Open the canvas with `/aicanvas` first. The bridge is registered by the browser page after it loads. Then check:

```text
http://127.0.0.1:8777/api/v2/opencode-canvas/health
```

If the port is already occupied by an old runtime, stop that process and run `/aicanvas` again.

## Dependencies are missing

Run the installer from the plugin root:

```powershell
.\scripts\install-runtime.ps1
```

or on macOS/Linux:

```bash
./scripts/install-runtime.sh
```

## Updating the plugin

The first version may still keep user data under `runtime/user/`. Back it up before deleting or recloning the plugin directory.
