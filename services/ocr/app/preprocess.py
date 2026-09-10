"""Preprocesado de imagen para OCR: escala de grises → deskew → binarización.

Funciones sobre `np.ndarray` (BGR o gris), testeables sin binario de OCR.
"""

from __future__ import annotations

import cv2
import numpy as np

_MAX_SIDE = 2200  # techo de resolución para no reventar memoria/tiempo


def decode_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("no se pudo decodificar la imagen")
    return img


def to_gray(img: np.ndarray) -> np.ndarray:
    if img.ndim == 2:
        return img
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def downscale(gray: np.ndarray, max_side: int = _MAX_SIDE) -> np.ndarray:
    h, w = gray.shape[:2]
    longest = max(h, w)
    if longest <= max_side:
        return gray
    scale = max_side / longest
    return cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def estimate_skew_angle(gray: np.ndarray) -> float:
    """Ángulo de inclinación en grados (positivo = rotada CCW)."""
    inverted = cv2.bitwise_not(gray)
    _, thresh = cv2.threshold(inverted, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(thresh > 0))
    if coords.shape[0] < 50:
        return 0.0
    angle = cv2.minAreaRect(coords.astype(np.float32))[-1]
    angle = -(90 + angle) if angle < -45 else -angle
    return float(angle) if abs(angle) <= 15 else 0.0


def deskew(gray: np.ndarray) -> np.ndarray:
    angle = estimate_skew_angle(gray)
    if abs(angle) < 0.2:
        return gray
    h, w = gray.shape[:2]
    matrix = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(
        gray, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )


def binarize(gray: np.ndarray) -> np.ndarray:
    denoised = cv2.bilateralFilter(gray, 5, 40, 40)
    return cv2.adaptiveThreshold(
        denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
    )


def preprocess(data: bytes) -> np.ndarray:
    """bytes de imagen → np.ndarray binarizado, listo para tesseract."""
    gray = downscale(to_gray(decode_image(data)))
    return binarize(deskew(gray))
