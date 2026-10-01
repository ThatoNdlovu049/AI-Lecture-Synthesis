"""Starts the lecture worker (worker.py) as a separate process and restarts it
if it has stopped. Set START_WORKER=0 to run the worker by hand instead."""
import os
import sys
import subprocess

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_process = None


def ensure_running():
    global _process
    if os.environ.get("START_WORKER", "1") == "0":
        return
    if _process is not None and _process.poll() is None:
        return

    log = open(os.path.join(BACKEND_DIR, "worker.log"), "a", encoding="utf-8")
    _process = subprocess.Popen(
        [sys.executable, os.path.join(BACKEND_DIR, "worker.py")],
        cwd=BACKEND_DIR,
        stdout=log,
        stderr=subprocess.STDOUT,
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
    )
    print(f"Lecture worker started (PID {_process.pid}), output in worker.log", flush=True)


def stop():
    if _process is not None and _process.poll() is None:
        _process.terminate()
        try:
            _process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            _process.kill()
