import canvasCommandRegistry, {
  CanvasCommandError,
  CanvasCommandRegistry,
  createCanvasCommandError,
  createCanvasCommandRegistry,
} from "./commandRegistry.js";
import {
  executeCanvasCommand,
  executeCanvasCommandPlan,
  hasCanvasCommandPlanVariableReference,
} from "./commandExecutor.js";
import { createCanvasCommandContext } from "./commandContext.js";
import { registerGenerationCommands } from "./generationCommands.js";
import { registerGraphCommands } from "./graphCommands.js";
import { registerLayoutCommands } from "./layoutCommands.js";
import { registerMediaComposeCommands } from "./mediaComposeCommands.js";
import { registerMediaProbeCommands } from "./mediaProbeCommands.js";
import { registerModelParamCommands } from "./modelParamCommands.js";
import { registerPromptCommands } from "./promptCommands.js";
import { registerSelectionCommands } from "./selectionCommands.js";
import { registerStorylineCommands } from "./storylineCommands.js";
import { registerViewportCommands } from "./viewportCommands.js";

export function registerDefaultCanvasCommands(registry = canvasCommandRegistry) {
  registerGraphCommands(registry);
  registerSelectionCommands(registry);
  registerViewportCommands(registry);
  registerPromptCommands(registry);
  registerModelParamCommands(registry);
  registerLayoutCommands(registry);
  registerStorylineCommands(registry);
  registerMediaProbeCommands(registry);
  registerMediaComposeCommands(registry);
  registerGenerationCommands(registry);
  return registry;
}

registerDefaultCanvasCommands(canvasCommandRegistry);

export {
  CanvasCommandError,
  CanvasCommandRegistry,
  createCanvasCommandContext,
  createCanvasCommandError,
  createCanvasCommandRegistry,
  canvasCommandRegistry,
  executeCanvasCommand,
  executeCanvasCommandPlan,
  hasCanvasCommandPlanVariableReference,
};
