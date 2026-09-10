import base64

import pytest

from app.image_source import load_image_bytes
from app.models import OcrRequest


async def test_load_from_base64_with_data_uri_prefix() -> None:
    payload = b"x" * 300
    b64 = "data:image/png;base64," + base64.b64encode(payload).decode()
    out = await load_image_bytes(OcrRequest(imageBase64=b64))
    assert out == payload


async def test_load_rejects_bad_base64() -> None:
    with pytest.raises(ValueError):
        await load_image_bytes(OcrRequest(imageBase64="!!!not base64!!!"))


async def test_load_rejects_tiny_payload() -> None:
    b64 = base64.b64encode(b"tiny").decode()
    with pytest.raises(ValueError):
        await load_image_bytes(OcrRequest(imageBase64=b64))


def test_request_requires_a_source() -> None:
    with pytest.raises(ValueError):
        OcrRequest()
