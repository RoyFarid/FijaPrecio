import io

import cv2
import numpy as np
import pytest
from PIL import Image, ImageDraw

from app.preprocess import (
    binarize,
    decode_image,
    deskew,
    downscale,
    estimate_skew_angle,
    preprocess,
    to_gray,
)


def _receipt_png(rotate: float = 0.0, size: tuple[int, int] = (600, 900)) -> bytes:
    img = Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(img)
    for i, line in enumerate(
        ["BODEGA DON JOSE", "RUC 20512345678", "HARINA 1KG   S/ 4.50", "TOTAL   S/ 4.50"]
    ):
        draw.text((40, 60 + i * 80), line, fill="black")
    if rotate:
        img = img.rotate(rotate, expand=True, fillcolor="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_decode_and_gray() -> None:
    img = decode_image(_receipt_png())
    assert img.ndim == 3
    gray = to_gray(img)
    assert gray.ndim == 2


def test_decode_rejects_garbage() -> None:
    with pytest.raises(ValueError):
        decode_image(b"not an image at all")


def test_downscale_caps_longest_side() -> None:
    big = np.zeros((4000, 1000), dtype=np.uint8)
    out = downscale(big, max_side=2200)
    assert max(out.shape) == 2200


def test_binarize_is_uint8_two_tone() -> None:
    gray = to_gray(decode_image(_receipt_png()))
    binary = binarize(gray)
    assert binary.dtype == np.uint8
    assert set(np.unique(binary)).issubset({0, 255})


def test_estimate_skew_detects_rotation() -> None:
    gray = to_gray(decode_image(_receipt_png(rotate=6.0)))
    angle = estimate_skew_angle(gray)
    assert abs(angle) > 1.5  # detecta que está torcida


def test_deskew_reduces_skew() -> None:
    gray = to_gray(decode_image(_receipt_png(rotate=6.0)))
    corrected = deskew(gray)
    assert abs(estimate_skew_angle(corrected)) < abs(estimate_skew_angle(gray))


def test_preprocess_end_to_end() -> None:
    out = preprocess(_receipt_png(rotate=3.0))
    assert out.ndim == 2
    assert out.dtype == np.uint8


def test_preprocess_grayscale_input() -> None:
    gray = to_gray(decode_image(_receipt_png()))
    ok, encoded = cv2.imencode(".png", gray)
    assert ok
    out = preprocess(encoded.tobytes())
    assert out.ndim == 2
