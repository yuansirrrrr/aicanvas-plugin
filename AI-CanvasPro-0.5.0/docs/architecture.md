# Architecture

AI-CanvasPro is packaged as an OpenCode plugin repository.

```text
ai-canvaspro/
  ai-canvaspro.js        OpenCode plugin entry
  runtime/               AI-CanvasPro web runtime
  scripts/               dependency installers
  docs/                  plugin docs
```

The OpenCode plugin does not run the old AI-CanvasPro agent planner. OpenCode is the agent. It calls plugin tools, and those tools call the live canvas bridge:

```text
OpenCode tool
-> ai-canvaspro.js
-> http://127.0.0.1:8777/api/v2/opencode-canvas/*
-> runtime/server.py
-> browser page bridge
-> executeCanvasCommand(commandId, args, canvasCommandContext)
```

`runtime/src/modules/opencodeCanvasBridge.js` registers the current canvas context, `canvasCommandRegistry.list()`, and `listAgentSkills()` with `runtime/server.py`. OpenCode can then call fixed tools such as `aicanvas_create_node`, or the dynamic `aicanvas_call_command` tool for any command exposed by the runtime registry.
