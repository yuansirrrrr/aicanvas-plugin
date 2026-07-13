import appStore from '../src/core/stores/appStore.js';
import { buildApiUrl } from './apiBase.js';

let evtSource = null;
let reconnectTimer = null;
let started = false;

export function shouldMonitorLocalServerConnection(locationLike = globalThis?.location) {
  try {
    const protocol = String(locationLike?.protocol || '').toLowerCase();
    const hostname = String(locationLike?.hostname || '').toLowerCase();

    if (protocol === 'file:') return true;
    if (!hostname) return true;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') {
      return true;
    }
    if (/^127\./.test(hostname)) return true;

    return false;
  } catch {
    return true;
  }
}

function connect() {
  if (typeof EventSource !== 'function') {
    appStore.setServerConnection(true);
    return;
  }

  if (evtSource) evtSource.close();
  evtSource = new EventSource(buildApiUrl('/api/v2/heartbeat_stream'));
  evtSource.onopen = () => {
    appStore.setServerConnection(true);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };
  evtSource.onerror = () => {
    appStore.setServerConnection(false);
    evtSource.close();
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 2000);
    }
  };
}

export function startServerConnectionMonitor() {
  if (started) return;
  started = true;

  if (!shouldMonitorLocalServerConnection()) {
    appStore.setServerConnection(true);
    return;
  }

  setTimeout(connect, 1000);
}
