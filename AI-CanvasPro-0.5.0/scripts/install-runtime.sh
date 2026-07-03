#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
RUNTIME_ROOT="${PLUGIN_ROOT}/runtime"
VENV_ROOT="${RUNTIME_ROOT}/.venv"
PYTHON="${VENV_ROOT}/bin/python"

if [[ ! -f "${RUNTIME_ROOT}/server.py" ]]; then
  echo "runtime/server.py not found under ${PLUGIN_ROOT}" >&2
  exit 1
fi

cd "${RUNTIME_ROOT}"

if [[ ! -x "${PYTHON}" ]]; then
  python3 -m venv .venv
fi

"${PYTHON}" -m pip install --upgrade pip
"${PYTHON}" -m pip install -r requirements.txt
"${PYTHON}" -m py_compile server.py

echo "AI-CanvasPro runtime dependencies installed."
echo "Runtime: ${RUNTIME_ROOT}"
echo "Python:  ${PYTHON}"
echo "Use /aicanvas in OpenChamber to start http://127.0.0.1:8777/"
