const BRIDGE_BASE = "/api/v2/opencode-canvas";
const REGISTER_INTERVAL_MS = 2500;
const POLL_INTERVAL_MS = 600;
const REQUEST_TIMEOUT_MS = 10000;
const RUNTIME_ID_STORAGE_KEY = "aicanvas.opencode.runtimeId";

function createRuntimeId() {
  const random = Math.random().toString(36).slice(2);
  return `browser-${Date.now().toString(36)}-${random}`;
}

function getStableRuntimeId() {
  const existingRuntimeId = String(window.__openCodeCanvasBridge?.runtimeId || "").trim();
  if (existingRuntimeId) return existingRuntimeId;

  try {
    const storedRuntimeId = String(window.sessionStorage?.getItem(RUNTIME_ID_STORAGE_KEY) || "").trim();
    if (storedRuntimeId) return storedRuntimeId;
  } catch {
  }

  const runtimeId = createRuntimeId();
  try {
    window.sessionStorage?.setItem(RUNTIME_ID_STORAGE_KEY, runtimeId);
  } catch {
  }
  return runtimeId;
}

function cloneJson(value, fallback = null) {
  if (value === undefined) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

async function postJson(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BRIDGE_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || `Bridge request failed with ${response.status}`);
    }
    return payload ?? {};
  } finally {
    clearTimeout(timer);
  }
}

async function buildContext({ graphStore, executeCanvasCommand, canvasCommandContext }) {
  try {
    const summary = await executeCanvasCommand("graph.getCanvasSummary", {}, canvasCommandContext);
    return cloneJson(summary, {}) || {};
  } catch {
    const state = graphStore?.getState?.() || {};
    return {
      projectId: window.currentProjectId || "",
      nodes: cloneJson(state.nodes, {}),
      edges: cloneJson(state.edges, []),
      selectedNodeIds: cloneJson(state.selectedNodeIds, []),
      viewport: cloneJson(state.viewport, {}),
    };
  }
}

async function buildRegistrationPayload(options, runtimeId) {
  const {
    graphStore,
    canvasCommandRegistry,
    executeCanvasCommand,
    canvasCommandContext,
    listAgentSkills,
  } = options;
  const commands = typeof canvasCommandRegistry?.list === "function"
    ? canvasCommandRegistry.list()
    : [];
  const skills = typeof listAgentSkills === "function"
    ? listAgentSkills()
    : [];
  const context = await buildContext({ graphStore, executeCanvasCommand, canvasCommandContext });
  return {
    runtimeId,
    commands: cloneJson(commands, []),
    skills: cloneJson(skills, []),
    context,
  };
}

async function executeBridgeJob(job, options) {
  const { executeCanvasCommand, canvasCommandContext } = options;
  const jobId = String(job?.jobId || "");
  const commandId = String(job?.commandId || "");
  if (!jobId || !commandId) return;
  try {
    const result = await executeCanvasCommand(commandId, job?.args || {}, canvasCommandContext);
    await postJson("/runtime/result", {
      jobId,
      ok: true,
      result: cloneJson(result, result ?? null),
    });
  } catch (error) {
    await postJson("/runtime/result", {
      jobId,
      ok: false,
      error: error instanceof Error ? error.message : String(error || "Canvas command failed"),
    }).catch(() => undefined);
  }
}

export function installOpenCodeCanvasBridge(options = {}) {
  if (window.__openCodeCanvasBridge?.stop) {
    window.__openCodeCanvasBridge.stop();
  }

  const runtimeId = getStableRuntimeId();
  let stopped = false;
  let registering = false;
  let polling = false;
  let lastPayload = null;

  const register = async () => {
    if (stopped || registering) return;
    registering = true;
    try {
      lastPayload = await buildRegistrationPayload(options, runtimeId);
      await postJson("/runtime/register", lastPayload);
    } catch (error) {
      console.warn("[opencode-canvas-bridge] register failed", error);
    } finally {
      registering = false;
    }
  };

  const poll = async () => {
    if (stopped || polling) return;
    polling = true;
    try {
      if (!lastPayload) {
        lastPayload = await buildRegistrationPayload(options, runtimeId);
      } else {
        lastPayload.context = await buildContext(options);
      }
      const payload = await postJson("/runtime/poll", lastPayload);
      const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
      for (const job of jobs) {
        await executeBridgeJob(job, options);
      }
    } catch (error) {
      if (!stopped) console.warn("[opencode-canvas-bridge] poll failed", error);
    } finally {
      polling = false;
    }
  };

  const registerTimer = window.setInterval(register, REGISTER_INTERVAL_MS);
  const pollTimer = window.setInterval(poll, POLL_INTERVAL_MS);
  const refresh = () => {
    void register();
    void poll();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState !== "hidden") refresh();
  };
  window.addEventListener("focus", refresh);
  window.addEventListener("pageshow", refresh);
  document.addEventListener("visibilitychange", onVisibilityChange);
  void register();
  void poll();

  const api = {
    runtimeId,
    register,
    poll,
    stop() {
      stopped = true;
      window.clearInterval(registerTimer);
      window.clearInterval(pollTimer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
  window.__openCodeCanvasBridge = api;
  return api;
}
