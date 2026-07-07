import { probeVideoNodes } from "../mediaProbeVideo.js";
import { getCanvasState, normalizeText } from "../storyline/canvasNodeSnapshot.js";

function normalizeIds(value) {
  const ids = Array.isArray(value) ? value : [];
  const seen = new Set();
  const normalized = [];
  for (const id of ids) {
    const text = normalizeText(id);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    normalized.push(text);
  }
  return normalized;
}

function validateNodeIds(ids, context) {
  const nodes = getCanvasState(context).nodes || {};
  const missingIds = ids.filter((id) => !nodes[id]);
  if (missingIds.length > 0) {
    return {
      ok: false,
      errorCode: "NODE_NOT_FOUND",
      message: `Canvas node(s) not found: ${missingIds.join(", ")}`,
      details: { missingIds },
    };
  }
  return { ok: true };
}

export function registerMediaProbeCommands(registry) {
  registry.register({
    id: "media.probeVideo",
    description: "Probe video nodes and return local path, duration, dimensions, fps, and availability.",
    riskLevel: "safe",
    argsSchema: {
      properties: {
        ids: { type: "array", items: { type: "string" } },
      },
      selectionFallback: true,
    },
    capabilitySchema: {
      reads: ["nodes", "selection", "files"],
      writes: [],
      requiresMountedRuntime: true,
      requiresSystemAccess: true,
      selectionFallback: true,
    },
    returnSchema: {
      aliasFields: ["videos", "errors"],
    },
    validate(args = {}, context = {}) {
      const state = getCanvasState(context);
      const fallbackIds = Array.isArray(state.selectedNodeIds) ? state.selectedNodeIds : [];
      const ids = normalizeIds(args.ids?.length ? args.ids : fallbackIds);
      if (ids.length < 1) {
        return {
          ok: false,
          errorCode: "NO_VIDEO_NODES",
          message: "media.probeVideo requires at least one selected video node id.",
        };
      }
      const nodeValidation = validateNodeIds(ids, context);
      if (!nodeValidation.ok) return nodeValidation;
      return { args: { ids } };
    },
    async execute(args = {}, context = {}) {
      const nodes = getCanvasState(context).nodes || {};
      return probeVideoNodes(args.ids, nodes);
    },
  });
}
