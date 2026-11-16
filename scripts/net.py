"""Small HTTP helpers for the scripts that go online (standard library only).

  fetch(url)        -> Reply(status, headers, body, url, error), never raises
  ssl_context()     the default TLS context; on a Mac whose python.org Python has no CA bundle
                    it falls back to the system's /etc/ssl/cert.pem (verification stays on)
"""
from __future__ import annotations

import os
import ssl
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

AGENT = "profile-widgets/1.0"
_CTX = None


def ssl_context() -> ssl.SSLContext:
    global _CTX
    if _CTX is None:
        _CTX = ssl.create_default_context()
        paths = ssl.get_default_verify_paths()
        if not (paths.cafile or paths.capath or os.environ.get("SSL_CERT_FILE")) and os.path.exists("/etc/ssl/cert.pem"):
            _CTX.load_verify_locations("/etc/ssl/cert.pem")
    return _CTX


@dataclass
class Reply:
    status: int = 0
    headers: dict = field(default_factory=dict)
    body: bytes = b""
    url: str = ""
    error: str = ""

    @property
    def ok(self) -> bool:
        return 200 <= self.status < 300

    @property
    def type(self) -> str:
        return self.headers.get("content-type", "").split(";")[0].strip().lower()


def fetch(url: str, method: str = "GET", headers: dict | None = None, data: bytes | None = None,
          timeout: float = 20, limit: int = 4_000_000, tries: int = 1, wait: float = 3.0) -> Reply:
    """One request (retried `tries` times on a network error or a 5xx answer)."""
    last = Reply(url=url)
    for attempt in range(max(1, tries)):
        if attempt:
            time.sleep(wait)
        req = urllib.request.Request(url, method=method, data=data, headers={"User-Agent": AGENT, **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ssl_context()) as r:
                last = Reply(r.status, {k.lower(): v for k, v in r.headers.items()}, r.read(limit) if method != "HEAD" else b"", r.url)
        except urllib.error.HTTPError as e:
            body = b""
            try:
                body = e.read(limit)
            except Exception:  # noqa: BLE001 - the body is only a nicety
                pass
            last = Reply(e.code, {k.lower(): v for k, v in (e.headers or {}).items()}, body, url, f"HTTP {e.code}")
        except Exception as e:  # noqa: BLE001 - DNS, TLS, timeouts: report, don't crash
            last = Reply(0, {}, b"", url, f"{type(e).__name__}: {e}")
        if last.status and last.status < 500:
            break
    return last
