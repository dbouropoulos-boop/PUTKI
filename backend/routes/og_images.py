"""
PUTKI HQ - OG image admin router.

Surfaces a tiny back-office API on top of og_image_generator.py:

  GET    /api/admin/og-images/list?limit=200    - list cached OG cards on disk
  GET    /api/admin/og-images/preview?slug=...  - resolve current OG URL for a slug
  POST   /api/admin/og-images/regenerate        - force re-generation via Gemini Nano Banana
  POST   /api/admin/og-images/upload            - upload a custom OG PNG/JPG (multipart)
  DELETE /api/admin/og-images/{slug}            - delete the cached file

Auth: every endpoint is gated by the X-Admin-Token header via the shared
require_admin dependency.
"""
from __future__ import annotations

import logging
import os
import re
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from og_image_generator import (
    OG_DIR,
    PUBLIC_PREFIX,
    _output_path,
    _slugify,
    ensure_og_image,
    is_enabled,
    public_url,
)

logger = logging.getLogger(__name__)

# Match what the generator stores: PNG cards keyed by slugified article slug.
ALLOWED_UPLOAD_MIME = {"image/png", "image/jpeg", "image/webp"}
MAX_UPLOAD_BYTES = 4 * 1024 * 1024  # 4 MB hard cap; Twitter/FB rejects bigger.


class OgRegenerateBody(BaseModel):
    slug: str
    headline: str
    category: Optional[str] = None


def _safe_slug(value: str) -> str:
    """Defence-in-depth - reject anything that could escape the OG dir."""
    s = _slugify(value or "")
    if not s or ".." in s or "/" in s:
        raise HTTPException(status_code=400, detail="invalid_slug")
    return s


def build_og_images_router(require_admin: Callable) -> APIRouter:
    router = APIRouter(prefix="/admin/og-images", tags=["admin.og-images"])

    @router.get("/list")
    async def list_cached(limit: int = 200, _: None = Depends(require_admin)) -> Dict[str, Any]:
        """Return the currently cached OG cards on disk, newest first."""
        if not OG_DIR.exists():
            return {"items": [], "count": 0, "enabled": is_enabled()}
        items: List[Dict[str, Any]] = []
        for p in sorted(OG_DIR.glob("*.png"), key=lambda x: x.stat().st_mtime, reverse=True)[:limit]:
            stat = p.stat()
            items.append({
                "slug": p.stem,
                "url": f"{PUBLIC_PREFIX}/{p.name}",
                "size_bytes": stat.st_size,
                "modified_at": int(stat.st_mtime),
            })
        return {"items": items, "count": len(items), "enabled": is_enabled()}

    @router.get("/preview")
    async def preview(slug: str, _: None = Depends(require_admin)) -> Dict[str, Any]:
        """Resolve the current OG URL for a given article slug.
        Returns {url, exists, size_bytes?} - never generates."""
        clean = _safe_slug(slug)
        path = _output_path(clean)
        exists = path.exists()
        out: Dict[str, Any] = {
            "slug": clean,
            "url": public_url(clean) if exists else None,
            "exists": exists,
        }
        if exists:
            out["size_bytes"] = path.stat().st_size
            out["modified_at"] = int(path.stat().st_mtime)
        return out

    @router.post("/regenerate")
    async def regenerate(body: OgRegenerateBody,
                         _: None = Depends(require_admin)) -> Dict[str, Any]:
        """Delete any cached file then call ensure_og_image to rebuild
        via Gemini Nano Banana. Returns the new public URL or null on
        upstream failure (LLM budget, key missing, etc.)."""
        if not is_enabled():
            raise HTTPException(status_code=503, detail="og_generation_disabled")
        clean = _safe_slug(body.slug)
        path = _output_path(clean)
        try:
            if path.exists():
                path.unlink()
        except OSError as e:
            logger.warning("og.regenerate.unlink_failed slug=%s err=%s", clean, e)
        url = await ensure_og_image(clean, body.headline, body.category)
        return {
            "slug": clean,
            "url": url,
            "regenerated": url is not None,
            "category": body.category,
        }

    @router.post("/upload")
    async def upload(slug: str = Form(...),
                     file: UploadFile = File(...),
                     _: None = Depends(require_admin)) -> Dict[str, Any]:
        """Upload a custom OG image. Replaces any cached file for the slug."""
        clean = _safe_slug(slug)
        if file.content_type not in ALLOWED_UPLOAD_MIME:
            raise HTTPException(
                status_code=415,
                detail=f"unsupported_mime · expected one of {sorted(ALLOWED_UPLOAD_MIME)}",
            )
        raw = await file.read()
        if not raw:
            raise HTTPException(status_code=400, detail="empty_file")
        if len(raw) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="file_too_large")
        OG_DIR.mkdir(parents=True, exist_ok=True)
        path = _output_path(clean)
        path.write_bytes(raw)
        return {
            "slug": clean,
            "url": public_url(clean),
            "size_bytes": len(raw),
            "uploaded_at": int(time.time()),
        }

    @router.delete("/{slug}")
    async def delete_cached(slug: str, _: None = Depends(require_admin)) -> Dict[str, Any]:
        clean = _safe_slug(slug)
        path = _output_path(clean)
        existed = path.exists()
        if existed:
            try:
                path.unlink()
            except OSError as e:
                raise HTTPException(status_code=500, detail=f"unlink_failed: {e}") from e
        return {"slug": clean, "deleted": existed}

    return router
