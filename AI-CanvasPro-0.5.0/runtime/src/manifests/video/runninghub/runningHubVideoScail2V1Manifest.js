import {
  RH_INSTANCE_FIELD,
  RH_VIDEO_FPS_30_FIELD,
  RH_VIDEO_RESOLUTION_FIELD,
  createRunningHubVideoExecutionManifest,
  createRunningHubVideoModelManifest,
} from '../../shared/runningHubVideoManifestShared.js';

export const RH_VIDEO_SCAIL2_V1_MODEL_ID = 'runninghub/2064961300823896065';
export const RH_VIDEO_SCAIL2_V1_EXECUTION_ID = 'runninghub.workflow.video-scail2-v1.v1';
export const RH_VIDEO_SCAIL_V2_MODEL_ID = 'runninghub/2065463417577762818';
export const RH_VIDEO_SCAIL_V2_EXECUTION_ID = 'runninghub.workflow.video-scail-v2.v1';

const RH_VIDEO_SCAIL_RESOLUTION_FIELD = Object.freeze({
  ...RH_VIDEO_RESOLUTION_FIELD,
  defaultValue: 1024,
});

export const RH_VIDEO_SCAIL2_V1_HELP_TOOLTIP = [
  '视频编辑 Scail V1 用法',
  '接入 [[red:源视频]] + [[red:参考图]]，按提示词和高级参数做视频编辑',
  '更多详细的疑难解答，请看[[red:阿硕飞书文档的视频编辑 V5.X]]',
].join('\n');

export const RH_VIDEO_SCAIL_V2_HELP_TOOLTIP = [
  '视频编辑 Scail V2 用法',
  '接入 [[red:源视频]] + [[red:参考图]]，按提示词和高级参数做视频编辑',
  '更多详细的疑难解答，请看[[red:阿硕飞书文档的视频编辑 V5.X]]',
].join('\n');

const RH_VIDEO_SCAIL_PANEL_EXTENSION = Object.freeze({
  sourceFrameCountFps: 'v54',
  submitScopeTargetEdges: true,
  frameStateDefaults: Object.freeze({
    frameRate: 24,
    frameCount: 300,
  }),
  adaptiveRatio: Object.freeze({
    scopeTargetEdges: true,
    preferSlot: 'sourceVideo',
    preferVideoKind: true,
  }),
});

const RH_VIDEO_SCAIL_FIXED_ASSET_SLOTS = Object.freeze(['sourceVideo', 'refImage']);

const RH_VIDEO_SCAIL_FIXED_INPUT_SLOTS = Object.freeze([
  Object.freeze({
    id: 'sourceVideo',
    kind: 'video',
    label: '源视频',
    required: true,
  }),
  Object.freeze({
    id: 'refImage',
    kind: 'image',
    label: '参考图',
    required: true,
  }),
]);

const RH_VIDEO_SCAIL_UI_FIELDS = Object.freeze([
  RH_VIDEO_SCAIL_RESOLUTION_FIELD,
  RH_VIDEO_FPS_30_FIELD,
  Object.freeze({
    id: 'rhVideoFrames',
    type: 'stepper',
    placement: 'videoParams',
    label: '帧数',
    defaultValue: 300,
    min: 0,
    max: 999999,
    step: 1,
  }),
  Object.freeze({
    id: 'rhScail2PersonCount',
    type: 'stepper',
    placement: 'videoAdvanced',
    variant: 'advancedRow',
    label: '识别人数',
    ariaLabel: '识别人数',
    defaultValue: 2,
    min: 1,
    max: 999999,
    step: 1,
    description: '用于告诉工作流需要检测识别的主体人数。识别人数不准时再调整。',
  }),
  Object.freeze({
    id: 'rhScailDetectPrompt',
    type: 'textarea',
    placement: 'videoAdvanced',
    variant: 'advancedRow',
    label: '检测识别提示词',
    defaultValue: 'person',
    allowEmpty: true,
    description: '用于指定检测识别目标。默认是 person，如无特殊要求请勿修改。',
  }),
  Object.freeze({
    id: 'rhScail2ReplaceSubject',
    type: 'segmented',
    placement: 'videoAdvanced',
    variant: 'advancedRow',
    label: '替换主体',
    defaultValue: false,
    description: '控制是否用参考图替换源视频中的主体。默认否，不需要替换主体时保持否。',
    options: Object.freeze([
      Object.freeze({ value: true, label: '是' }),
      Object.freeze({ value: false, label: '否' }),
    ]),
  }),
  RH_INSTANCE_FIELD,
]);

const RH_VIDEO_SCAIL_V2_ENHANCED_MOTION_CONTROL_FIELD = Object.freeze({
  id: 'rhScailV2EnhancedMotionControl',
  type: 'segmented',
  placement: 'videoAdvanced',
  variant: 'advancedRow',
  label: '强化动作控制',
  defaultValue: false,
  description: '加强源视频动作控制约束。默认否，动作不稳定或跟随不足时再开启。',
  options: Object.freeze([
    Object.freeze({ value: true, label: '是' }),
    Object.freeze({ value: false, label: '否' }),
  ]),
});

const RH_VIDEO_SCAIL_NODE_INFO_LIST = Object.freeze([
  Object.freeze({
    nodeId: '336',
    fieldName: 'video',
    source: 'videoInput',
    required: true,
    description: '上传视频',
  }),
  Object.freeze({
    nodeId: '338',
    fieldName: 'image',
    source: 'imageInput',
    field: 'inputUrls',
    required: true,
    description: '上传图片',
  }),
  Object.freeze({
    nodeId: '444',
    fieldName: 'value',
    source: 'param',
    fields: Object.freeze(['generationParams.rhScail2ReplaceSubject', 'rhScail2ReplaceSubject']),
    defaultValue: false,
    transform: 'booleanString',
    description: '替换人物/动作参考',
  }),
  Object.freeze({
    nodeId: '324',
    fieldName: 'value',
    source: 'param',
    fields: Object.freeze(['generationParams.rhVideoResolution', 'rhVideoResolution']),
    defaultValue: 1024,
    transform: Object.freeze({ name: 'integer', min: 832 }),
    description: '分辨率',
  }),
  Object.freeze({
    nodeId: '383',
    fieldName: 'value',
    source: 'param',
    fields: Object.freeze(['generationParams.rhScail2PersonCount', 'rhScail2PersonCount']),
    defaultValue: 2,
    transform: Object.freeze({ name: 'integer', min: 1 }),
    description: '识别人数',
  }),
  Object.freeze({
    nodeId: '318',
    fieldName: 'value',
    source: 'param',
    fields: Object.freeze(['generationParams.rhScailDetectPrompt', 'rhScailDetectPrompt']),
    defaultValue: 'person',
    allowEmpty: true,
    description: '检测识别提示词',
  }),
  Object.freeze({
    nodeId: '317',
    fieldName: 'value',
    source: 'constant',
    defaultValue: '',
    includeEmpty: true,
    description: '提示词',
  }),
  Object.freeze({
    nodeId: '336',
    fieldName: 'force_rate',
    source: 'param',
    fields: Object.freeze(['generationParams.rhVideoFps', 'rhVideoFps', 'frameRate']),
    defaultValue: 24,
    transform: 'normalizeRhVideoFps',
    description: '帧率',
  }),
  Object.freeze({
    nodeId: '336',
    fieldName: 'frame_load_cap',
    source: 'param',
    fields: Object.freeze(['generationParams.rhVideoFrames', 'rhVideoFrames', 'frameCount']),
    defaultValue: 300,
    transform: Object.freeze({ name: 'integer', min: 0 }),
    description: '生成时长（帧数）',
  }),
]);

const RH_VIDEO_SCAIL_V2_NODE_INFO_LIST = Object.freeze([
  ...RH_VIDEO_SCAIL_NODE_INFO_LIST,
  Object.freeze({
    nodeId: '458',
    fieldName: 'value',
    source: 'param',
    fields: Object.freeze([
      'generationParams.rhScailV2EnhancedMotionControl',
      'rhScailV2EnhancedMotionControl',
    ]),
    defaultValue: false,
    transform: 'booleanString',
    description: '强化动作控制',
  }),
]);

function createScailVideoModelManifest({
  modelId,
  executionId,
  displayName,
  description,
  helpTooltip,
  extraUiFields = [],
}) {
  return createRunningHubVideoModelManifest({
    modelId,
    executionId,
    displayName,
    description,
    vip: false,
    subscriptionAliases: [],
    help: Object.freeze({ tooltip: helpTooltip }),
    extensions: Object.freeze({
      videoParameterPanel: RH_VIDEO_SCAIL_PANEL_EXTENSION,
    }),
    fixedAssetSlots: RH_VIDEO_SCAIL_FIXED_ASSET_SLOTS,
    inputSlots: {
      allowedKinds: ['text', 'image', 'video'],
      minByKind: { image: 1, video: 1 },
      maxByKind: { image: 1, video: 1, audio: 0 },
      fixedSlots: RH_VIDEO_SCAIL_FIXED_INPUT_SLOTS,
    },
    uiFields: Object.freeze([...RH_VIDEO_SCAIL_UI_FIELDS, ...extraUiFields]),
  });
}

function createScailVideoExecutionManifest({ id, label, workflowId, nodeInfoList = RH_VIDEO_SCAIL_NODE_INFO_LIST }) {
  return createRunningHubVideoExecutionManifest({
    id,
    label,
    workflowId,
    submitMode: 'openapi-v2-ai-app',
    queryMode: 'openapi-v2-query',
    mapping: {
      nodeInfoList,
    },
  });
}

export const rhVideoScail2V1ModelManifest = createScailVideoModelManifest({
  modelId: RH_VIDEO_SCAIL2_V1_MODEL_ID,
  executionId: RH_VIDEO_SCAIL2_V1_EXECUTION_ID,
  displayName: '视频编辑 Scail V1',
  description: '源视频 + 参考图的 Scail 视频编辑工作流',
  helpTooltip: RH_VIDEO_SCAIL2_V1_HELP_TOOLTIP,
});

export const rhVideoScail2V1ExecutionManifest = createScailVideoExecutionManifest({
  id: RH_VIDEO_SCAIL2_V1_EXECUTION_ID,
  label: '视频编辑 Scail V1',
  workflowId: '2064961300823896065',
});

export const rhVideoScailV2ModelManifest = createScailVideoModelManifest({
  modelId: RH_VIDEO_SCAIL_V2_MODEL_ID,
  executionId: RH_VIDEO_SCAIL_V2_EXECUTION_ID,
  displayName: '视频编辑 Scail V2',
  description: '源视频 + 参考图的 Scail V2 视频编辑工作流',
  helpTooltip: RH_VIDEO_SCAIL_V2_HELP_TOOLTIP,
  extraUiFields: Object.freeze([RH_VIDEO_SCAIL_V2_ENHANCED_MOTION_CONTROL_FIELD]),
});

export const rhVideoScailV2ExecutionManifest = createScailVideoExecutionManifest({
  id: RH_VIDEO_SCAIL_V2_EXECUTION_ID,
  label: '视频编辑 Scail V2',
  workflowId: '2065463417577762818',
  nodeInfoList: RH_VIDEO_SCAIL_V2_NODE_INFO_LIST,
});
