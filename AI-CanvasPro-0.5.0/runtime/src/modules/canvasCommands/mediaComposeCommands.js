import { composeSelectedVideos } from "../VideoComposeController.js";
import { createCanvasCommandError } from "./commandRegistry.js";

function normalizeIds(value) {
  const ids = Array.isArray(value) ? value : [];
  const normalized = [];
  const seen = new Set();
  for (const id of ids) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId || seen.has(normalizedId)) continue;
    normalized.push(normalizedId);
    seen.add(normalizedId);
  }
  return normalized;
}

function getState(context) {
  return context?.store?.getStateRaw?.() || context?.store?.getState?.() || {};
}

function validateVideoNodes(ids, context) {
  const nodes = getState(context).nodes || {};
  const missing = [];
  for (const id of ids) {
    if (!nodes[id]) missing.push(id);
  }
  if (missing.length > 0) {
    throw createCanvasCommandError(
      "NODE_NOT_FOUND",
      `Canvas video compose node(s) not found: ${missing.join(", ")}`,
      { missingIds: missing },
    );
  }
}

export function registerMediaComposeCommands(registry) {
  registry.register({
    id: "media.composeVideos",
    description: "Compose multiple selected video nodes into one source-video node.",
    riskLevel: "confirm",
    argsSchema: {
      required: ["ids"],
      properties: {
        ids: { type: "array", items: { type: "string" } },
        order: { type: "string", enum: ["selection", "canvas", "provided"] },
        timeline: { type: "array" },
      },
      selectionFallback: true,
    },
    capabilitySchema: {
      reads: ["nodes", "selection"],
      writes: ["nodes", "selection", "files"],
      requiresMountedRuntime: true,
      requiresSystemAccess: true,
      selectionFallback: true,
    },
    returnSchema: {
      aliasFields: ["ids", "mediaKind", "status"],
    },
    validate(args = {}, context = {}) {
      const fallbackIds = getState(context).selectedNodeIds || [];
      const ids = normalizeIds(args.ids?.length ? args.ids : fallbackIds);
      if (ids.length < 2) {
        return {
          ok: false,
          errorCode: "INSUFFICIENT_VIDEO_NODES",
          message: "media.composeVideos requires at least two selected video node ids.",
        };
      }
      try {
        validateVideoNodes(ids, context);
      } catch (error) {
        return {
          ok: false,
          errorCode: error.errorCode || "INVALID_VIDEO_NODES",
          message: error.message,
          details: error.details,
        };
      }
      const orderValue = String(args.order || "selection").trim();
      const order = orderValue === "provided" ? "provided" : orderValue === "canvas" ? "canvas" : "selection";
      const timeline = Array.isArray(args.timeline) ? args.timeline : [];
      return { args: { ids, order, timeline } };
    },
    async execute(args) {
      await composeSelectedVideos(args.ids, null, { order: args.order, timeline: args.timeline });
      return {
        ids: args.ids,
        mediaKind: "video",
        order: args.order,
        status: "compose-requested",
        timeline: args.timeline,
      };
    },
  });
}
