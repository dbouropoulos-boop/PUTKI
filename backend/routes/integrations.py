"""
PUTKI HQ - Integration health-check admin router.

Surfaces test-connection probes for the third-party integrations
configured via /back-office/integrations. The probes are deliberately
non-mutating - they only read from the upstream provider and report
back HTTP status + content type + latency.

  POST /api/admin/integrations/smartico/test-connection
       Body: { loader_url }
       Pings the loader URL with a short-timeout GET and confirms the
       response looks like a JavaScript SDK. Returns
       { ok, status, content_type, latency_ms, message? }.
"""
from __future__ import annotations

import logging
import time
from typing import Callable, Dict
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Anything in this set counts as "looks like a JS SDK loader".
JS_CONTENT_TYPES = {
    "application/javascript",
    "text/javascript",
    "application/x-javascript",
}


class SmarticoProbeBody(BaseModel):
    loader_url: str


def build_integrations_router(require_admin: Callable) -> APIRouter:
    router = APIRouter(prefix="/admin/integrations", tags=["admin.integrations"])

    @router.post("/smartico/test-connection")
    async def smartico_test(body: SmarticoProbeBody,
                            _: None = Depends(require_admin)) -> Dict:
        url = (body.loader_url or "").strip()
        if not url:
            raise HTTPException(status_code=400, detail="loader_url_required")
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise HTTPException(status_code=400, detail="invalid_loader_url")

        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
                r = await client.get(url, headers={
                    "User-Agent": "PutkiHQ-IntegrationProbe/1.0",
                })
            latency_ms = int((time.perf_counter() - start) * 1000)
            ct = (r.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
            ok = r.status_code == 200 and ct in JS_CONTENT_TYPES
            if r.status_code != 200:
                msg = f"HTTP {r.status_code} from loader URL."
            elif ct not in JS_CONTENT_TYPES:
                msg = (
                    f"Reachable but content-type is '{ct or 'unknown'}'. "
                    f"Expected one of {sorted(JS_CONTENT_TYPES)}."
                )
            else:
                msg = "Loader script reachable and serves JavaScript."
            return {
                "ok": ok,
                "status": r.status_code,
                "content_type": ct or None,
                "latency_ms": latency_ms,
                "message": msg,
            }
        except httpx.TimeoutException:
            return {
                "ok": False, "status": None, "content_type": None,
                "latency_ms": int((time.perf_counter() - start) * 1000),
                "message": "Timeout after 6s reaching loader URL.",
            }
        except httpx.HTTPError as e:
            return {
                "ok": False, "status": None, "content_type": None,
                "latency_ms": int((time.perf_counter() - start) * 1000),
                "message": f"Network error: {type(e).__name__}",
            }

    return router
