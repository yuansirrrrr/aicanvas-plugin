import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_VIP_GATE_MODEL_ID,
  DREAMINA_VIDEO_VIP_MODEL_ID,
  RH_ADVANCED_VOICE_CLONE_VIP_AI_APP_MODEL_ID,
  RH_ADVANCED_VOICE_CLONE_VIP_MODEL_ID,
  RH_VIDEO_HD_VIP_AI_APP_MODEL_ID,
  RH_VIDEO_HD_VIP_MODEL_ID,
  SUBSCRIPTION_GATE_MANIFESTS,
  isModelAllowed,
  isVipModel,
  resolveVipGateModelId,
} from './subscriptionAccess.js';

test('subscription access: shared gate manifest keeps non-Scail VIP gates', () => {
  assert.ok(SUBSCRIPTION_GATE_MANIFESTS.some((gate) => gate.key === 'runninghubVideoV54'));
  assert.ok(SUBSCRIPTION_GATE_MANIFESTS.some((gate) => gate.key === 'runninghubVideoHd'));
  assert.ok(SUBSCRIPTION_GATE_MANIFESTS.some((gate) => gate.key === 'runninghubAdvancedVoiceClone'));
  assert.ok(SUBSCRIPTION_GATE_MANIFESTS.some((gate) => gate.key === 'dreaminaVideoVip'));
});

test('subscription access: Scail V1 and V2 do not enter VIP gate', () => {
  const scailIds = [
    'runninghub/2064961300823896065',
    '2064961300823896065',
    'ai-app/2064961300823896065',
    'runninghub/2065463417577762818',
    '2065463417577762818',
    'ai-app/2065463417577762818',
  ];

  for (const id of scailIds) {
    assert.equal(resolveVipGateModelId(id), id);
    assert.equal(isVipModel(id), false);
    assert.equal(isModelAllowed(id, { status: 'none', entitledModelIds: [], entitledModelKeys: [] }), true);
  }
});

test('subscription access: V5.4 remains VIP gated', () => {
  assert.equal(resolveVipGateModelId(DEFAULT_VIP_GATE_MODEL_ID), DEFAULT_VIP_GATE_MODEL_ID);
  assert.equal(resolveVipGateModelId('2041741496667348994'), DEFAULT_VIP_GATE_MODEL_ID);
  assert.equal(isVipModel(DEFAULT_VIP_GATE_MODEL_ID), true);
  assert.equal(isVipModel('2041741496667348994'), true);
  assert.equal(isModelAllowed(DEFAULT_VIP_GATE_MODEL_ID, { status: 'none' }), false);
});

test('subscription access: Bernini remains an independent VIP gate despite V5.4 aliases', () => {
  const bernini = 'runninghub/2062515720147259393';

  assert.equal(resolveVipGateModelId(bernini), bernini);
  assert.equal(resolveVipGateModelId('ai-app/2062515720147259393'), bernini);
  assert.equal(isVipModel(bernini), true);
  assert.equal(isModelAllowed(bernini, { status: 'none', entitledModelKeys: ['video_edit_v54'] }), false);
  assert.equal(isModelAllowed(bernini, { status: 'active', entitledModelKeys: ['video_edit_v54'] }), true);
});

test('subscription access: HD and voice clone ai-app aliases remain VIP gated', () => {
  assert.equal(isVipModel(RH_VIDEO_HD_VIP_MODEL_ID), true);
  assert.equal(isVipModel(RH_VIDEO_HD_VIP_AI_APP_MODEL_ID), true);
  assert.equal(
    isModelAllowed(RH_VIDEO_HD_VIP_MODEL_ID, {
      status: 'active',
      entitledModelIds: [RH_VIDEO_HD_VIP_AI_APP_MODEL_ID],
    }),
    true,
  );

  assert.equal(isVipModel(RH_ADVANCED_VOICE_CLONE_VIP_MODEL_ID), true);
  assert.equal(isVipModel(RH_ADVANCED_VOICE_CLONE_VIP_AI_APP_MODEL_ID), true);
  assert.equal(isVipModel('advanced_voice_clone'), true);
});

test('subscription access: Dreamina provider maps to Dreamina video VIP gate', () => {
  assert.equal(resolveVipGateModelId('dreamina/seedance2.0_vip'), DREAMINA_VIDEO_VIP_MODEL_ID);
  assert.equal(resolveVipGateModelId('anything', 'dreamina'), DREAMINA_VIDEO_VIP_MODEL_ID);
  assert.equal(
    isModelAllowed('dreamina/seedance2.0fast', {
      status: 'active',
      entitledModelIds: [DREAMINA_VIDEO_VIP_MODEL_ID],
      entitledModelKeys: [],
    }, 'dreamina'),
    true,
  );
});
