import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = {
  __aicInstallId: '',
  showToast: () => {},
  _triggerLocalCacheSave: () => {},
};

globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  body: {
    classList: {
      add: () => {},
      remove: () => {},
    },
  },
};

const { setAssetMentionAssets, _resetAssetMentionRegistryForTests } = await import(
  '../../modules/assetMentionRegistry.js'
);
const { createVideoNodeTaskOrchestrationModule } = await import('./taskOrchestrationModule.js');

test('video payload includes image asset refs stored on the prompt node', async () => {
  _resetAssetMentionRegistryForTests();
  setAssetMentionAssets([
    {
      id: 'asset1',
      name: 'Reference Asset',
      items: [
        {
          type: 'image',
          url: 'https://cdn.example.com/ref.png',
          label: 'Reference Image',
        },
      ],
    },
  ]);

  const node = {
    id: 'v1',
    type: 'ai-video',
    provider: 'deeprouterai',
    model: 'deeprouterai/veo-3.1-generate-preview',
    promptAssetInputRefs: [{ assetId: 'asset1', itemIndex: 0, type: 'image' }],
    generationParams: {},
  };
  const state = { nodes: { v1: node } };
  const store = {
    getState: () => state,
    getStateRaw: () => state,
    getIncomingEdges: () => [],
    updateNodeData: () => {},
    dispatchEvent: () => {},
  };
  const module = createVideoNodeTaskOrchestrationModule({
    store,
    api: {},
    getImage: async () => null,
    startLoading: () => {},
    stopLoading: () => {},
    ensureConfig: async () => {},
    getProviderConfig: () => ({}),
    isVideoVipModel: () => false,
    ensureVipSessionRecheck: async () => {},
  });
  const context = {
    ...module,
    nodeId: 'v1',
    _data: node,
    promptEl: {
      innerHTML: 'animate the reference',
      textContent: 'animate the reference',
      innerText: 'animate the reference',
      value: 'animate the reference',
    },
    _resolveMediaUrl: (value) => value,
    _isRunninghubWorkflowModel: () => false,
    _isDreaminaVideoNode: () => false,
    _resolveDreaminaAdaptiveAspectRatioFromNode: () => '',
  };

  const payload = await module._buildPayloadImpl.call(context);

  assert.deepEqual(payload.images, ['https://cdn.example.com/ref.png']);
  assert.deepEqual(payload.inputImageUrls, ['https://cdn.example.com/ref.png']);
  assert.deepEqual(payload.inputUrls, ['https://cdn.example.com/ref.png']);
});

test('video payload includes image asset refs from prompt pills', async () => {
  _resetAssetMentionRegistryForTests();
  setAssetMentionAssets([
    {
      id: 'asset1',
      name: 'Reference Asset',
      items: [
        {
          type: 'image',
          url: 'https://cdn.example.com/ref.png',
          label: 'Reference Image',
        },
      ],
    },
  ]);

  const node = {
    id: 'v1',
    type: 'ai-video',
    provider: 'deeprouterai',
    model: 'deeprouterai/veo-3.1-generate-preview',
    generationParams: {},
  };
  const state = { nodes: { v1: node } };
  const store = {
    getState: () => state,
    getStateRaw: () => state,
    getIncomingEdges: () => [],
    updateNodeData: () => {},
    dispatchEvent: () => {},
  };
  const module = createVideoNodeTaskOrchestrationModule({
    store,
    api: {},
    getImage: async () => null,
    startLoading: () => {},
    stopLoading: () => {},
    ensureConfig: async () => {},
    getProviderConfig: () => ({}),
    isVideoVipModel: () => false,
    ensureVipSessionRecheck: async () => {},
  });
  const refPill = {
    dataset: {
      refOrigin: 'asset',
      assetId: 'asset1',
      assetIndex: '0',
      refType: 'image',
      label: 'Reference Image',
    },
    classList: {
      contains: (name) => name === 'ref-pill',
    },
    textContent: 'Reference Image',
  };
  const context = {
    ...module,
    nodeId: 'v1',
    _data: node,
    promptEl: {
      innerHTML:
        '<span class="ref-pill" data-ref-origin="asset" data-asset-id="asset1" data-asset-index="0" data-ref-type="image">Reference Image</span> animate',
      textContent: 'Reference Image animate',
      innerText: 'Reference Image animate',
      value: 'Reference Image animate',
      querySelectorAll: (selector) => (selector === '.ref-pill' ? [refPill] : []),
    },
    _resolveMediaUrl: (value) => value,
    _isRunninghubWorkflowModel: () => false,
    _isDreaminaVideoNode: () => false,
    _resolveDreaminaAdaptiveAspectRatioFromNode: () => '',
  };

  const payload = await module._buildPayloadImpl.call(context);

  assert.deepEqual(payload.images, ['https://cdn.example.com/ref.png']);
  assert.deepEqual(payload.inputImageUrls, ['https://cdn.example.com/ref.png']);
  assert.deepEqual(payload.inputUrls, ['https://cdn.example.com/ref.png']);
});
