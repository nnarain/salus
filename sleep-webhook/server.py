"""Receives Sleep as Android webhooks and logs completed tracking sessions as Health Tracker sleep entries.

Sleep as Android POSTs {"event": ..., "value1": ..., ...} for each enabled automation event. Tracking
events carry no timestamps or sleep stats, so bedtime/wake are taken from when the events arrive.
"""

import hmac
import json
import os
import threading
import time
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from zoneinfo import ZoneInfo

API_URL = os.environ.get("HEALTH_TRACKER_API_URL", "http://localhost:3000").rstrip("/")
TIMEZONE = ZoneInfo(os.environ.get("TZ", "UTC"))
TOKEN = os.environ.get("WEBHOOK_TOKEN", "")
STATE_FILE = Path(os.environ.get("STATE_FILE", "/data/state.json"))
MIN_SLEEP_MINUTES = int(os.environ.get("MIN_SLEEP_MINUTES", "120"))
PORT = int(os.environ.get("PORT", "8000"))
MAX_BODY_BYTES = 4096

lock = threading.Lock()


def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text())
    except (FileNotFoundError, ValueError):
        return {}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state))
    tmp.replace(STATE_FILE)


def api(method: str, resource: str, body: dict | None = None) -> dict:
    request = urllib.request.Request(
        f"{API_URL}/api/{resource}",
        data=None if body is None else json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method=method,
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def log_sleep(started: float, stopped: float, paused_seconds: float) -> None:
    minutes = round((stopped - started - paused_seconds) / 60)
    if not MIN_SLEEP_MINUTES <= minutes <= 1440:
        print(f"Ignoring {minutes}-minute session (outside {MIN_SLEEP_MINUTES}-1440)", flush=True)
        return

    bed = datetime.fromtimestamp(started, TIMEZONE)
    wake = datetime.fromtimestamp(stopped, TIMEZONE)
    wake_date = wake.date().isoformat()
    # POST /api/sleep replaces the day's entry, so keep anything logged by hand.
    existing = next((e for e in api("GET", "sleep")["data"] if e["wake_date"][:10] == wake_date), {})
    entry = {
        "wake_date": wake_date,
        "bedtime": bed.strftime("%H:%M"),
        "wake_time": wake.strftime("%H:%M"),
        "sleep_duration_minutes": minutes,
        "restedness": existing.get("restedness"),
        "notes": existing.get("notes"),
    }
    try:
        api("POST", "sleep", entry)
    except Exception:
        print(f"Failed to log sleep entry: {json.dumps(entry)}", flush=True)
        raise
    print(f"Logged sleep: {json.dumps(entry)}", flush=True)


def handle_event(event: str) -> None:
    now = time.time()
    with lock:
        state = load_state()
        if event == "sleep_tracking_started":
            state = {"started": now, "paused_seconds": 0, "paused_at": None}
        elif event == "sleep_tracking_paused" and state.get("started") and not state.get("paused_at"):
            state["paused_at"] = now
        elif event == "sleep_tracking_resumed" and state.get("paused_at"):
            state["paused_seconds"] += now - state["paused_at"]
            state["paused_at"] = None
        elif event == "sleep_tracking_stopped" and state.get("started"):
            if state.get("paused_at"):
                state["paused_seconds"] += now - state["paused_at"]
            save_state({})
            log_sleep(state["started"], now, state["paused_seconds"])
            return
        else:
            return
        save_state(state)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        self.reply(200 if urlsplit(self.path).path == "/health" else 404)

    def do_POST(self) -> None:
        url = urlsplit(self.path)
        token = parse_qs(url.query).get("token", [""])[0]
        if url.path != "/webhook":
            return self.reply(404)
        if not hmac.compare_digest(token.encode(), TOKEN.encode()):
            return self.reply(401)

        length = int(self.headers.get("Content-Length") or 0)
        if not 0 < length <= MAX_BODY_BYTES:
            return self.reply(400)
        try:
            event = json.loads(self.rfile.read(length))["event"]
        except (ValueError, KeyError, TypeError):
            return self.reply(400)
        if not isinstance(event, str):
            return self.reply(400)

        print(f"Received event: {event}", flush=True)
        try:
            handle_event(event)
        except Exception as error:
            print(f"Error handling {event}: {error}", flush=True)
            return self.reply(502)
        self.reply(200)

    def reply(self, status: int) -> None:
        self.send_response(status)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, format: str, *args) -> None:
        # Default access log would print the token from the query string.
        pass


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("WEBHOOK_TOKEN must be set")
    print(f"Listening on :{PORT}, forwarding to {API_URL}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
