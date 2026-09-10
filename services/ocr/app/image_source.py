"""Obtención de los bytes de la imagen: base64 inline o descarga por URL."""

from __future__ import annotations

import base64
import binascii

import httpx

from app.config import get_settings
from app.models import OcrRequest


async def load_image_bytes(req: OcrRequest) -> bytes:
    settings = get_settings()

    if req.image_base64:
        payload = req.image_base64.split(",", 1)[-1]  # tolera "data:image/png;base64,..."
        try:
            data = base64.b64decode(payload, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("imageBase64 inválido") from exc
    elif req.image_url:
        async with httpx.AsyncClient(timeout=settings.download_timeout_seconds) as client:
            resp = await client.get(req.image_url)
            resp.raise_for_status()
            data = resp.content
    else:  # pragma: no cover - lo valida el modelo
        raise ValueError("sin imagen")

    if len(data) > settings.max_image_bytes:
        raise ValueError(f"imagen demasiado grande ({len(data)} bytes)")
    if len(data) < 100:
        raise ValueError("imagen vacía o truncada")
    return data
