import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs"
import net from "node:net"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const PLUGIN_NAME = "ai-canvaspro"
const PLUGIN_DIR_NAMES = [PLUGIN_NAME, "ai-canvaspro-plugin", "AI-CanvasPro-0.5.0"]
const pluginDir = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_HOST = "127.0.0.1"
const DEFAULT_PORT = 8777
const DEFAULT_BRIDGE_REQUEST_TIMEOUT_MS = 60 * 1000
const IMAGE_GENERATION_COMMAND_TIMEOUT_MS = readPositiveIntEnv("AICANVAS_IMAGE_GENERATION_TIMEOUT_MS", 190 * 1000)
const VIDEO_GENERATION_COMMAND_TIMEOUT_MS = readPositiveIntEnv("AICANVAS_VIDEO_GENERATION_TIMEOUT_MS", 490 * 1000)
const GENERATION_COMMAND_TIMEOUT_MS = readPositiveIntEnv("AICANVAS_GENERATION_TIMEOUT_MS", VIDEO_GENERATION_COMMAND_TIMEOUT_MS)

function readPositiveIntEnv(name, fallback) {
  const value = Number.parseInt(String(process.env[name] || ""), 10)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function getOpenCodeHome() {
  if (process.env.OPENCODE_HOME) return path.resolve(process.env.OPENCODE_HOME)
  if (process.env.OPENCODE_CONFIG_HOME) return path.resolve(process.env.OPENCODE_CONFIG_HOME)
  const home = process.env.USERPROFILE || process.env.HOME || ""
  return home ? path.join(home, ".config", "opencode") : ""
}

function getExplicitPluginDirs() {
  const dirs = []
  const pluginsDir = process.env.AICANVASPRO_PLUGINS_DIR || process.env.OPENCODE_PLUGINS_DIR || ""
  if (pluginsDir) dirs.push(...PLUGIN_DIR_NAMES.map((name) => path.join(path.resolve(pluginsDir), name)))

  const explicitPlugin = process.env.AICANVASPRO_PLUGIN_PATH || process.env.AICANVASPRO_PLUGIN_FILE || ""
  if (explicitPlugin) {
    const resolved = path.resolve(explicitPlugin)
    dirs.push(path.basename(resolved).toLowerCase() === "ai-canvaspro.js" ? path.dirname(resolved) : resolved)
  }

  const explicitDir = process.env.AICANVASPRO_PLUGIN_DIR || ""
  if (explicitDir) dirs.push(path.resolve(explicitDir))
  return dirs
}

function getOpenCodePluginDirs() {
  const opencodeHome = getOpenCodeHome()
  const configuredDirs = opencodeHome
    ? PLUGIN_DIR_NAMES.map((name) => path.join(opencodeHome, "plugins", name))
    : []
  return [...new Set([...getExplicitPluginDirs(), ...configuredDirs])]
}

function findOpenCodePluginRuntimeRoots() {
  const pluginRoots = getOpenCodePluginDirs()
  const runtimeRoots = pluginRoots.map((root) => path.join(root, "runtime"))
  const pluginsRoot = pluginRoots.length > 0 ? path.dirname(pluginRoots[0]) : ""

  if (pluginsRoot && fs.existsSync(pluginsRoot)) {
    try {
      for (const entry of fs.readdirSync(pluginsRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const root = path.join(pluginsRoot, entry.name)
        if (fs.existsSync(path.join(root, "ai-canvaspro.js")) || hasRuntimeServer(path.join(root, "runtime"))) {
          runtimeRoots.push(path.join(root, "runtime"))
          runtimeRoots.push(path.join(root, "AI-CanvasPro-0.5.0", "runtime"))
        }
      }
    } catch {
    }
  }

  return [...new Set(runtimeRoots)]
}

function hasRuntimeServer(runtimeRoot) {
  return Boolean(runtimeRoot) && fs.existsSync(path.join(runtimeRoot, "server.py"))
}

function getDefaultRuntimeRoot() {
  const candidates = [
    process.env.AICANVASPRO_ROOT || "",
    path.join(pluginDir, "runtime"),
    ...findOpenCodePluginRuntimeRoots(),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (hasRuntimeServer(candidate)) return candidate
  }

  return candidates[0]
}

async function loadOpenCodePluginApi() {
  try {
    return await import("@opencode-ai/plugin")
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error
  }

  const opencodeHome = getOpenCodeHome()
  const candidates = [
    path.join(pluginDir, "node_modules", "@opencode-ai", "plugin", "dist", "index.js"),
    opencodeHome ? path.join(opencodeHome, "node_modules", "@opencode-ai", "plugin", "dist", "index.js") : "",
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return import(pathToFileURL(candidate).href)
    }
  }

  throw new Error("Cannot load @opencode-ai/plugin. Install OpenCode dependencies or run this plugin from ~/.config/opencode/plugins.")
}

const { tool } = await loadOpenCodePluginApi()

function normalizePort(value) {
  const port = Number.parseInt(String(value ?? DEFAULT_PORT), 10)
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : DEFAULT_PORT
}

function normalizeHost(value) {
  const host = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_HOST
  return host === "127.0.0.1" || host === "localhost" || host === "::1" ? host : DEFAULT_HOST
}

function resolveRuntimeRoot(value) {
  const candidate = typeof value === "string" && value.trim()
    ? path.resolve(value.trim())
    : getDefaultRuntimeRoot()
  const nestedRuntime = path.join(candidate, "runtime")
  const packagedNestedRuntime = path.join(path.dirname(candidate), "AI-CanvasPro-0.5.0", "runtime")
  if (!hasRuntimeServer(candidate) && hasRuntimeServer(nestedRuntime)) {
    return nestedRuntime
  }
  if (!hasRuntimeServer(candidate) && hasRuntimeServer(packagedNestedRuntime)) {
    return packagedNestedRuntime
  }
  return candidate
}

function bridgeBase(host = DEFAULT_HOST, port = DEFAULT_PORT) {
  return `http://${normalizeHost(host)}:${normalizePort(port)}/api/v2/opencode-canvas`
}

function isPortOpen(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    socket.setTimeout(700)
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("timeout", () => {
      socket.destroy()
      resolve(false)
    })
    socket.once("error", () => resolve(false))
  })
}

async function waitForServer(port, host, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isPortOpen(port, host)) return true
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

function resolvePython(runtimeRoot) {
  const candidates = process.platform === "win32"
    ? [
        path.join(runtimeRoot, ".venv", "Scripts", "pythonw.exe"),
        path.join(runtimeRoot, "venv", "Scripts", "pythonw.exe"),
        path.join(runtimeRoot, ".venv", "Scripts", "python.exe"),
        path.join(runtimeRoot, "venv", "Scripts", "python.exe"),
      ]
    : [
        path.join(runtimeRoot, ".venv", "bin", "python"),
        path.join(runtimeRoot, "venv", "bin", "python"),
      ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return process.platform === "win32" ? "python" : "python3"
}

function findExecutableOnPath(name) {
  const command = process.platform === "win32" ? "where.exe" : "which"
  const result = spawnSync(command, [name], {
    encoding: "utf8",
    windowsHide: true,
  })
  if (result.status !== 0 || typeof result.stdout !== "string") return ""
  const first = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
  return first && fs.existsSync(first) ? first : ""
}

function findFirstExisting(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }
  return ""
}

function findWingetFfmpegTool(toolName) {
  if (process.platform !== "win32") return ""
  const localAppData = process.env.LOCALAPPDATA || ""
  if (!localAppData) return ""
  const packagesRoot = path.join(localAppData, "Microsoft", "WinGet", "Packages")
  if (!fs.existsSync(packagesRoot)) return ""
  try {
    const packageDirs = fs.readdirSync(packagesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^Gyan\.FFmpeg_/i.test(entry.name))
      .map((entry) => path.join(packagesRoot, entry.name))
    const candidates = []
    for (const packageDir of packageDirs) {
      for (const entry of fs.readdirSync(packageDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        candidates.push(path.join(packageDir, entry.name, "bin", toolName))
      }
      candidates.push(path.join(packageDir, "bin", toolName))
    }
    return findFirstExisting(candidates)
  } catch {
    return ""
  }
}

function resolveMediaTools() {
  const ffmpegName = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
  const ffprobeName = process.platform === "win32" ? "ffprobe.exe" : "ffprobe"

  const ffmpeg = process.env.AIC_FFMPEG_EXE && fs.existsSync(process.env.AIC_FFMPEG_EXE)
    ? process.env.AIC_FFMPEG_EXE
    : findExecutableOnPath(ffmpegName)
      || findWingetFfmpegTool(ffmpegName)
      || "ffmpeg"

  const ffprobe = process.env.AIC_FFPROBE_EXE && fs.existsSync(process.env.AIC_FFPROBE_EXE)
    ? process.env.AIC_FFPROBE_EXE
    : findExecutableOnPath(ffprobeName)
      || findWingetFfmpegTool(ffprobeName)
      || "ffprobe"

  return { ffmpeg, ffprobe }
}

async function checkBridgeHealth(host = DEFAULT_HOST, port = DEFAULT_PORT) {
  return Boolean(await getBridgeHealth(host, port))
}

async function getBridgeHealth(host = DEFAULT_HOST, port = DEFAULT_PORT) {
  try {
    const response = await fetch(`${bridgeBase(host, port)}/health`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1500),
    })
    const payload = await response.json().catch(() => null)
    if (response.ok && payload?.ok === true) return payload
  } catch {
  }
  return null
}

function isInactiveBridgeHealth(health) {
  return Boolean(health) && health.ok !== true
}

function bridgeRuntimeState(health) {
  const runtimeRegistered = health?.runtimeRegistered === true
  return {
    bridgeReady: runtimeRegistered,
    runtimeRegistered,
  }
}

async function fetchText(url, timeoutMs = 1500) {
  const response = await fetch(url, {
    headers: { Accept: "text/html,*/*" },
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await response.text().catch(() => "")
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    text,
  }
}

function isDirectoryListingHtml(text) {
  return typeof text === "string" && /<title>\s*Directory listing for\s+/i.test(text)
}

function isAiCanvasAppHtml(text) {
  return typeof text === "string"
    && (text.includes("AI Canvas") || text.includes("AI-CanvasPro") || text.includes("app-version"))
}

async function resolveCanvasAppUrl(url) {
  try {
    const root = await fetchText(url)
    if (root.ok && isAiCanvasAppHtml(root.text) && !isDirectoryListingHtml(root.text)) {
      return url
    }
    if (root.ok && isDirectoryListingHtml(root.text) && root.text.includes('href="runtime/"')) {
      const runtimeUrl = new URL("runtime/", url).toString()
      const runtime = await fetchText(runtimeUrl)
      if (runtime.ok && isAiCanvasAppHtml(runtime.text) && !isDirectoryListingHtml(runtime.text)) {
        return runtimeUrl
      }
    }
  } catch {
  }
  return url
}

async function isAiCanvasServer(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(1500),
    })
    const serverHeader = response.headers.get("x-aicanvas-server") || ""
    return serverHeader.toLowerCase().includes("ai canvaspro")
  } catch {
    return false
  }
}

function findWindowsPidsOnPort(port) {
  if (process.platform !== "win32") return []
  const result = spawnSync("netstat.exe", ["-ano", "-p", "tcp"], {
    encoding: "utf8",
    windowsHide: true,
  })
  if (result.status !== 0 || typeof result.stdout !== "string") return []
  const portPattern = new RegExp(`:${port}\\s+.*\\s+LISTENING\\s+(\\d+)`, "i")
  const pids = new Set()
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(portPattern)
    if (match?.[1]) pids.add(match[1])
  }
  return [...pids]
}

function findUnixPidsOnPort(port) {
  if (process.platform === "win32") return []
  const pids = new Set()

  const lsof = spawnSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], {
    encoding: "utf8",
    windowsHide: true,
  })
  if (typeof lsof.stdout === "string") {
    for (const line of lsof.stdout.split(/\r?\n/)) {
      const pid = line.trim()
      if (/^\d+$/.test(pid)) pids.add(pid)
    }
  }

  if (pids.size === 0) {
    const ss = spawnSync("ss", ["-ltnp"], {
      encoding: "utf8",
      windowsHide: true,
    })
    if (typeof ss.stdout === "string") {
      const portPattern = new RegExp(`(?:^|[:.])${port}\\s+`)
      for (const line of ss.stdout.split(/\r?\n/)) {
        if (!portPattern.test(line)) continue
        for (const match of line.matchAll(/pid=(\d+)/g)) {
          pids.add(match[1])
        }
      }
    }
  }

  if (pids.size === 0) {
    const fuser = spawnSync("fuser", ["-n", "tcp", String(port)], {
      encoding: "utf8",
      windowsHide: true,
    })
    const output = `${fuser.stdout || ""}\n${fuser.stderr || ""}`
    for (const match of output.matchAll(/\b(\d+)\b/g)) {
      pids.add(match[1])
    }
  }

  return [...pids]
}

function findPidsOnPort(port) {
  return process.platform === "win32" ? findWindowsPidsOnPort(port) : findUnixPidsOnPort(port)
}

async function stopWindowsPid(pid, port, host) {
  if (!pid) return false
  const result = spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
    encoding: "utf8",
    windowsHide: true,
  })
  if (result.status !== 0) return false
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (!(await isPortOpen(port, host))) return true
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

async function stopUnixPid(pid, port, host) {
  const numericPid = Number.parseInt(String(pid), 10)
  if (!Number.isInteger(numericPid) || numericPid <= 0 || numericPid === process.pid) return false
  try {
    process.kill(numericPid, "SIGTERM")
  } catch {
    return false
  }

  let deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (!(await isPortOpen(port, host))) return true
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  try {
    process.kill(numericPid, "SIGKILL")
  } catch {
  }

  deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (!(await isPortOpen(port, host))) return true
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

async function stopPid(pid, port, host) {
  return process.platform === "win32"
    ? stopWindowsPid(pid, port, host)
    : stopUnixPid(pid, port, host)
}

async function stopCanvas(options = {}) {
  const host = normalizeHost(options.host)
  const port = normalizePort(options.port)
  const url = `http://${host}:${port}/`

  if (!(await isPortOpen(port, host))) {
    return { status: "not-running", url }
  }

  if (!(await isAiCanvasServer(url))) {
    throw new Error(`Port ${port} is in use, but it is not an AI-CanvasPro service. Refusing to stop it.`)
  }

  const pids = findPidsOnPort(port)
  if (pids.length === 0) {
    throw new Error(`AI-CanvasPro is running at ${url}, but the plugin could not find its process id. Install lsof, ss, or fuser, then try again.`)
  }

  const stoppedPids = []
  for (const pid of pids) {
    if (await stopPid(pid, port, host)) {
      stoppedPids.push(pid)
    }
  }
  if (await isPortOpen(port, host)) {
    throw new Error(`Failed to stop all AI-CanvasPro processes on port ${port}. Tried: ${pids.join(", ")}.`)
  }

  return { status: "stopped", url, pids: stoppedPids.length > 0 ? stoppedPids : pids }
}

async function waitForBridge(host, port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await checkBridgeHealth(host, port)) return true
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return false
}

async function startCanvas(options = {}) {
  const runtimeRoot = resolveRuntimeRoot(options.runtimeRoot || options.appRoot)
  const host = normalizeHost(options.host)
  const port = normalizePort(options.port)
  const serverPath = path.join(runtimeRoot, "server.py")
  const url = `http://${host}:${port}/`

  if (!fs.existsSync(serverPath)) {
    throw new Error(`AI-CanvasPro runtime server.py not found: ${serverPath}`)
  }

  if (await isPortOpen(port, host)) {
    const bridgeHealth = await getBridgeHealth(host, port)
    if (!bridgeHealth) {
      throw new Error(`Port ${port} is already in use, but AI-CanvasPro bridge is not healthy. Stop that process or set AICANVASPRO_PORT.`)
    }
    if (isInactiveBridgeHealth(bridgeHealth)) {
      await stopCanvas({ host, port })
    } else {
      return {
        status: "already-running",
        url: await resolveCanvasAppUrl(url),
        serviceUrl: url,
        runtimeRoot,
        ...bridgeRuntimeState(bridgeHealth),
      }
    }
  }

  const python = resolvePython(runtimeRoot)
  const mediaTools = resolveMediaTools()
  const child = spawn(python, ["server.py", String(port), host], {
    cwd: runtimeRoot,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      AICANVAS_PORT: String(port),
      AICANVAS_HOST: host,
      AIC_FFMPEG_EXE: mediaTools.ffmpeg,
      AIC_FFPROBE_EXE: mediaTools.ffprobe,
    },
  })
  child.unref()

  const ready = await waitForServer(port, host)
  if (!ready) {
    throw new Error(`AI-CanvasPro did not become ready at ${url}. Run scripts/install-runtime first if dependencies are missing.`)
  }

  const bridgeHealth = await getBridgeHealth(host, port)
  return {
    status: "started",
    url: await resolveCanvasAppUrl(url),
    serviceUrl: url,
    runtimeRoot,
    ...bridgeRuntimeState(bridgeHealth),
  }
}

function parseJsonObject(value, fieldName) {
  if (!value || !String(value).trim()) return {}
  const parsed = JSON.parse(String(value))
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON object`)
  }
  return parsed
}

function parseJsonArray(value, fieldName) {
  const parsed = JSON.parse(String(value || "[]"))
  if (!Array.isArray(parsed)) throw new Error(`${fieldName} must be a JSON array`)
  return parsed
}

async function bridgeRequest(method, route, body, options = {}) {
  const host = normalizeHost(options.host)
  const port = normalizePort(options.port)
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : DEFAULT_BRIDGE_REQUEST_TIMEOUT_MS
  const response = await fetch(`${bridgeBase(host, port)}${route}`, {
    method,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || `AI-CanvasPro bridge returned ${response.status}`)
  }
  return payload
}

async function callCanvasCommand(command, args, options = {}) {
  const generationKind = String(args?.generationType || args?.nodeType || args?.type || args?.kind || "").toLowerCase()
  const generationTimeoutMs = generationKind.includes("image")
    ? IMAGE_GENERATION_COMMAND_TIMEOUT_MS
    : generationKind.includes("video")
      ? VIDEO_GENERATION_COMMAND_TIMEOUT_MS
      : GENERATION_COMMAND_TIMEOUT_MS
  const requestOptions = command === "generation.run"
    ? { ...options, timeoutMs: generationTimeoutMs }
    : options
  return bridgeRequest("POST", `/commands/${encodeURIComponent(command)}`, { args: args || {} }, requestOptions)
}

async function assertConfirmedIfRisky(command, confirmed, options = {}) {
  const commandId = String(command || "")
  if (commandId === "generation.run") return
  if (confirmed === true) return
  const payload = await bridgeRequest("GET", "/commands", undefined, options).catch(() => null)
  const commands = Array.isArray(payload?.commands) ? payload.commands : []
  const metadata = commands.find((entry) => entry?.id === commandId)
  const riskLevel = String(metadata?.riskLevel || "").toLowerCase()
  const requiresConfirmation = riskLevel === "confirm"
    || riskLevel === "danger"
    || commandId === "generation.run"
  if (requiresConfirmation) {
    throw new Error(`AI-CanvasPro command "${commandId}" requires explicit user confirmation. Set confirmed=true only after the user confirms.`)
  }
}

function toolResult(title, payload) {
  return {
    title,
    output: JSON.stringify(payload, null, 2),
    metadata: payload,
  }
}

export const AiCanvasProPlugin = async () => {
  const hostArg = tool.schema.string().default(DEFAULT_HOST).describe("AI-CanvasPro bridge host.")
  const portArg = tool.schema.number().int().min(1).max(65535).default(DEFAULT_PORT).describe("AI-CanvasPro bridge port.")

  return {
    tool: {
      ai_canvaspro: tool({
        description: "Start or reuse the bundled AI-CanvasPro runtime. It does not open a system browser; use /aicanvas in OpenChamber for the built-in browser.",
        args: {
          port: portArg,
          host: hostArg,
          runtimeRoot: tool.schema.string().default("").describe("Optional AI-CanvasPro runtime directory. Defaults to this plugin's ./runtime."),
        },
        async execute(args, context) {
          const result = await startCanvas(args)
          context.metadata({
            title: "AI-CanvasPro",
            metadata: {
              url: result.url,
              runtimeRoot: result.runtimeRoot,
              bridge: `${bridgeBase(args.host, args.port)}/health`,
            },
          })
          return toolResult("AI-CanvasPro", {
            ...result,
            openedInSystemBrowser: false,
            bridge: `${bridgeBase(args.host, args.port)}/health`,
          })
        },
      }),

      aicanvas_stop: tool({
        description: "Stop the local AI-CanvasPro runtime service if it is running.",
        args: { host: hostArg, port: portArg },
        async execute(args) {
          return toolResult("AI-CanvasPro Stop", await stopCanvas(args))
        },
      }),

      aicanvas_get_context: tool({
        description: "Read current AI-CanvasPro canvas context, command registry, and CanvasPro skill catalog. Call this before canvas operations or whenever the user asks what CanvasPro can do.",
        args: { host: hostArg, port: portArg },
        async execute(args) {
          return toolResult("AI Canvas Context", await bridgeRequest("GET", "/context", undefined, args))
        },
      }),

      aicanvas_list_commands: tool({
        description: "List every AI-CanvasPro canvas command exposed by the live command registry, including schemas and risk levels.",
        args: { host: hostArg, port: portArg },
        async execute(args) {
          return toolResult("AI Canvas Commands", await bridgeRequest("GET", "/commands", undefined, args))
        },
      }),

      aicanvas_list_skills: tool({
        description: "List live AI-CanvasPro agent skills exposed by the CanvasPro runtime through the bridge. Use this when the user asks about CanvasPro skills or wants OpenCode to follow a CanvasPro workflow. Pick the matching skill, follow its workflow/planningRules, then execute its commands with aicanvas_call_command or the specialized aicanvas_* tools.",
        args: { host: hostArg, port: portArg },
        async execute(args) {
          return toolResult("AI Canvas Skills", await bridgeRequest("GET", "/skills", undefined, args))
        },
      }),

      aicanvas_call_command: tool({
        description: "Call any AI-CanvasPro canvasCommandRegistry command directly through the browser runtime bridge. Use command ids from aicanvas_list_commands or from a skill returned by aicanvas_list_skills. Do not use the AI-CanvasPro agent planner.",
        args: {
          command: tool.schema.string().describe("Command id from aicanvas_list_commands, for example node.create or graph.connect."),
          argsJson: tool.schema.string().default("{}").describe("JSON object arguments for the command schema."),
          confirmed: tool.schema.boolean().default(false).describe("Set true only after explicit user confirmation for confirm/danger commands."),
          host: hostArg,
          port: portArg,
        },
        async execute(args) {
          const commandArgs = parseJsonObject(args.argsJson, "argsJson")
          await assertConfirmedIfRisky(args.command, args.confirmed, args)
          return toolResult("AI Canvas Command", await callCanvasCommand(args.command, commandArgs, args))
        },
      }),

      aicanvas_compose_videos: tool({
        description: "Compose multiple selected AI-CanvasPro video nodes into one video. First read the selected nodes, pass their ids as idsJson, and ask the user for explicit confirmation.",
        args: {
          idsJson: tool.schema.string().describe("JSON array of selected video node ids, in the desired compose order."),
          order: tool.schema.string().default("selection").describe("Compose order: selection or canvas."),
          confirmed: tool.schema.boolean().default(false).describe("Must be true after explicit user confirmation because this writes an output video file."),
          host: hostArg,
          port: portArg,
        },
        async execute(args) {
          await assertConfirmedIfRisky("media.composeVideos", args.confirmed, args)
          return toolResult("AI Canvas Compose Videos", await callCanvasCommand("media.composeVideos", {
            ids: parseJsonArray(args.idsJson, "idsJson"),
            order: args.order === "canvas" ? "canvas" : "selection",
          }, args))
        },
      }),

      aicanvas_create_node: tool({
        description: "Create a canvas node by calling AI-CanvasPro node.create directly.",
        args: {
          type: tool.schema.string().default("ai-image").describe("Node type, for example ai-image, ai-video, source-image, source-text."),
          prompt: tool.schema.string().default("").describe("Optional prompt for generated nodes."),
          model: tool.schema.string().default("").describe("Optional model id."),
          provider: tool.schema.string().default("").describe("Optional provider id."),
          extraJson: tool.schema.string().default("{}").describe("Additional node.create JSON arguments."),
          host: hostArg,
          port: portArg,
        },
        async execute(args) {
          const extra = parseJsonObject(args.extraJson, "extraJson")
          return toolResult("AI Canvas Create Node", await callCanvasCommand("node.create", {
            ...extra,
            type: args.type,
            prompt: args.prompt,
            model: args.model || undefined,
            provider: args.provider || undefined,
          }, args))
        },
      }),

      aicanvas_set_prompt: tool({
        description: "Set a node prompt by calling AI-CanvasPro node.setPrompt directly.",
        args: {
          nodeId: tool.schema.string().describe("Target node id."),
          prompt: tool.schema.string().describe("New prompt text."),
          host: hostArg,
          port: portArg,
        },
        async execute(args) {
          return toolResult("AI Canvas Set Prompt", await callCanvasCommand("node.setPrompt", {
            nodeId: args.nodeId,
            prompt: args.prompt,
          }, args))
        },
      }),

      aicanvas_set_params: tool({
        description: "Set node generation/model params by calling AI-CanvasPro node.setParams directly.",
        args: {
          nodeId: tool.schema.string().describe("Target node id."),
          paramsJson: tool.schema.string().describe("JSON object of params to set."),
          host: hostArg,
          port: portArg,
        },
        async execute(args) {
          return toolResult("AI Canvas Set Params", await callCanvasCommand("node.setParams", {
            nodeId: args.nodeId,
            params: parseJsonObject(args.paramsJson, "paramsJson"),
          }, args))
        },
      }),

      aicanvas_connect_nodes: tool({
        description: "Connect two canvas nodes by calling AI-CanvasPro graph.connect directly.",
        args: {
          sourceId: tool.schema.string().describe("Source node id."),
          targetId: tool.schema.string().describe("Target node id."),
          host: hostArg,
          port: portArg,
        },
        async execute(args) {
          return toolResult("AI Canvas Connect", await callCanvasCommand("graph.connect", {
            sourceId: args.sourceId,
            targetId: args.targetId,
          }, args))
        },
      }),

      aicanvas_arrange_nodes: tool({
        description: "Arrange canvas nodes by calling layout.arrangeRow, layout.arrangeColumn, or layout.arrangeGrid directly.",
        args: {
          idsJson: tool.schema.string().describe("JSON array of node ids."),
          mode: tool.schema.string().default("row").describe("row, column, or grid."),
          gap: tool.schema.number().default(80).describe("Gap between nodes."),
          host: hostArg,
          port: portArg,
        },
        async execute(args) {
          const ids = parseJsonArray(args.idsJson, "idsJson")
          const command = args.mode === "column"
            ? "layout.arrangeColumn"
            : args.mode === "grid"
              ? "layout.arrangeGrid"
              : "layout.arrangeRow"
          return toolResult("AI Canvas Arrange", await callCanvasCommand(command, { ids, gap: args.gap }, args))
        },
      }),

      aicanvas_align_nodes: tool({
        description: "Align canvas nodes by calling AI-CanvasPro layout.align directly.",
        args: {
          idsJson: tool.schema.string().describe("JSON array of node ids."),
          mode: tool.schema.string().default("top").describe("Alignment mode supported by AI-CanvasPro."),
          host: hostArg,
          port: portArg,
        },
        async execute(args) {
          return toolResult("AI Canvas Align", await callCanvasCommand("layout.align", {
            ids: parseJsonArray(args.idsJson, "idsJson"),
            mode: args.mode,
          }, args))
        },
      }),

      aicanvas_run_generation: tool({
        description: "Run image or video generation by calling AI-CanvasPro generation.run directly.",
        args: {
          nodeId: tool.schema.string().default("").describe("Target node id. Leave empty only if the AI-CanvasPro command schema allows selection fallback."),
          generationType: tool.schema.string().default("auto").describe("Generation type for timeout selection: image, video, or auto."),
          extraJson: tool.schema.string().default("{}").describe("Additional generation.run JSON arguments."),
          confirmed: tool.schema.boolean().default(false).describe("Ignored for generation.run; kept for compatibility."),
          host: hostArg,
          port: portArg,
        },
        async execute(args) {
          const extra = parseJsonObject(args.extraJson, "extraJson")
          return toolResult("AI Canvas Run Generation", await callCanvasCommand("generation.run", {
            ...extra,
            nodeId: args.nodeId || undefined,
            generationType: args.generationType === "image" || args.generationType === "video" ? args.generationType : extra.generationType,
          }, args))
        },
      }),
    },
  }
}

export default AiCanvasProPlugin
