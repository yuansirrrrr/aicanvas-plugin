# AI-CanvasPro OpenCode Plugin

This repository contains the AI-CanvasPro plugin files for OpenCode:

- `ai-canvaspro.js`
- `AI-CanvasPro-0.5.0/`

## Install on a server

Clone this repository into the OpenCode plugin directory for the same user that runs OpenCode/OpenChamber:

```bash
mkdir -p ~/.config/opencode/plugins
cd ~/.config/opencode/plugins
git clone https://github.com/yuansirrrrr/aicanvas-plugin.git .
```

If the directory is not empty, clone elsewhere and copy the two plugin entries into `~/.config/opencode/plugins/`.

## Runtime dependencies

The local Python virtual environment is intentionally not committed. On Linux servers, create a fresh runtime venv:

```bash
cd ~/.config/opencode/plugins/AI-CanvasPro-0.5.0/runtime
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Install FFmpeg on the server:

```bash
sudo apt update
sudo apt install -y ffmpeg
```

OpenChamber should use the OpenCode executable path installed on the server, for example:

```text
/root/.opencode/bin/opencode
```
