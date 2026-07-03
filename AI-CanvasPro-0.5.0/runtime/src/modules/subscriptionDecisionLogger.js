const LOG_SOURCE = 'subscriptionAccess';
const LOG_PREFIX = '[subscriptionAccess]';

function normalizeLogText(value) {
  return String(value ?? '').trim();
}

function sanitizeSubscriptionLogContext(context = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(context && typeof context === 'object' ? context : {})) {
    if (/api[-_ ]?key|token|authorization|password|passwd|pwd|cdkey|secret|cookie|session|bearer/i.test(key)) {
      safe[key] = '[REDACTED]';
      continue;
    }
    if (Array.isArray(value)) {
      safe[key] = value.map((item) => normalizeLogText(item)).filter(Boolean);
      continue;
    }
    if (value && typeof value === 'object') {
      safe[key] = sanitizeSubscriptionLogContext(value);
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

export function logSubscriptionDecision(event, context = {}) {
  const eventName = normalizeLogText(event) || 'decision';
  const safeContext = sanitizeSubscriptionLogContext(context);
  const payload = {
    type: `subscription.${eventName}`,
    level: 'info',
    source: LOG_SOURCE,
    message: `Subscription ${eventName}`,
    context: safeContext,
  };

  try {
    const diagnostics =
      globalThis.window?.electronAPI?.diagnostics ||
      globalThis.window?.aiCanvasDesktop?.diagnostics;
    if (typeof diagnostics?.logEvent === 'function') {
      void Promise.resolve(diagnostics.logEvent(payload)).catch(() => {});
    }
  } catch {}

  try {
    if (typeof globalThis.window !== 'undefined' && typeof console?.info === 'function') {
      console.info(LOG_PREFIX, payload.type, safeContext);
    }
  } catch {}
}
