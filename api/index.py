"""Atelier export — server-side PDF / JPG / PNG rendering for SANAA.

Self-contained Vercel Python function (FastAPI `app`) at api/index.py.
Vercel only deploys a Python function in a Next.js project when the
file is a recognised entrypoint (api/index.py) reached by an explicit
vercel.json rewrite — a bare api/atelier/export.py is silently ignored
(the Next.js app answers 404 for /api/atelier/export/*). The rewrite
in vercel.json sends /api/atelier/export/* here; the FastAPI routes
below are declared at their full public paths, which is what the ASGI
app sees after the rewrite.

Adapted from the Atelier Kiggundu project (Python 3.12 + FastAPI +
Fabric.js), whose services this file vendors and adapts:

- app/services/documents.py   -> document validation (image sources
  extended to SANAA's R2 URLs)
- app/services/image_processing.py -> Pillow filters (unchanged)
- app/services/svg.py          -> dependency-free SVG rasterizer (unchanged)
- app/services/export_pdf.py   -> vector-first PDF renderer, with the
  fidelity gaps closed where the editor can produce them:
    * custom fonts: Manrope / DM Sans TTFs bundled in api/atelier/fonts
      and registered with ReportLab (Manrope has no italic — upright is
      used, documented below)
    * letterSpacing via pdf.setCharSpace, lineHeight, underline,
      italic mapped to Oblique variants
    * shadows: solid offset copy of the shape/text (ReportLab cannot
      blur — no fake blur is added, the offset copy is the shadow)
    * gradients: the editor cannot create gradient fills (only solid
      colour inputs), so nothing is lost here
- app/services/export_image.py -> high-resolution raster renderer, with
  the same bundled fonts, letter-spacing and solid shadows

Storage: NOTHING is written to local disk (Vercel's filesystem is
ephemeral). Images are fetched from R2 by public URL (server-side, so
no CORS is involved) and the rendered file is returned directly in
the response — never persisted.

Auth: the browser calls this same-origin with its cookies; the
`sanaa_session` JWT is verified here (HS256, SESSION_SECRET) exactly
like lib/auth.ts does, so only a signed-in SANAA user can export.
"""

import base64
import math
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

# ---------------------------------------------------------------- config

BASE_DIR = Path(__file__).resolve().parent
FONTS_DIR = BASE_DIR / "atelier" / "fonts"
R2_PUBLIC_URL = (os.environ.get("R2_PUBLIC_URL") or "").rstrip("/")
SESSION_SECRET = os.environ.get("SESSION_SECRET") or ""
COOKIE_NAME = "sanaa_session"
MAX_IMAGE_BYTES = 15 * 1024 * 1024

# ---------------------------------------------------------------- auth


def verify_session(request: Request):
    """Return the user id from the sanaa_session JWT, or None."""
    token = request.cookies.get(COOKIE_NAME)
    if not token or not SESSION_SECRET:
        return None
    try:
        import jwt as pyjwt

        payload = pyjwt.decode(token, SESSION_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        return user_id if isinstance(user_id, str) and user_id else None
    except Exception:
        return None


# ---------------------------------------------------------------- validation
# Adapted from Atelier app/services/documents.py. The only change is the
# image-source rule: images must come from SANAA's R2 (same-origin
# /api/r2/ or /api/atelier/file/ serving URLs, or the raw R2 public
# URL) or be an inline data: URL (abstract compositions the editor
# generates locally).

UPLOAD_SOURCE = re.compile(
    r"^(?:/api/r2/uploads/[A-Za-z0-9_-]+/[a-f0-9-]{36}\.(?:jpe?g|png|webp|svg)"
    r"|/api/atelier/file/atelier/uploads/[A-Za-z0-9_-]+/[a-f0-9]{32}\.(?:jpe?g|png|webp|svg)"
    r"|https?://[^/]+/uploads/[A-Za-z0-9_-]+/[a-f0-9-]{36}\.(?:jpe?g|png|webp|svg))$",
    re.IGNORECASE,
)
DATA_SOURCE = re.compile(r"^data:image/(?:png|jpe?g|webp|svg\+xml);base64,", re.IGNORECASE)


def validate_document(document):
    pages = document.get("pages") or [document]
    if not isinstance(pages, list) or not 1 <= len(pages) <= 100:
        raise ValueError("Un projet doit contenir de 1 à 100 pages.")
    for page in pages:
        if not isinstance(page, dict):
            raise ValueError("Format de page invalide.")
        for dimension in ("width", "height"):
            try:
                value = float(page.get(dimension, 1080))
            except (TypeError, ValueError):
                raise ValueError("Dimensions de page invalides.")
            if not math.isfinite(value) or value < 1 or value > 6000:
                raise ValueError("Les dimensions doivent être comprises entre 1 et 6000 px.")
        for dimension in ("physicalWidthMm", "physicalHeightMm"):
            if dimension in page:
                try:
                    physical = float(page[dimension])
                except (TypeError, ValueError):
                    raise ValueError("Dimension physique invalide.")
                if not math.isfinite(physical) or not 1 <= physical <= 6000:
                    raise ValueError("Les dimensions physiques sont hors limite.")
        objects = page.get("objects", [])
        if not isinstance(objects, list) or len(objects) > 1000:
            raise ValueError("Chaque page accepte au maximum 1000 éléments.")
        for obj in objects:
            if not isinstance(obj, dict):
                raise ValueError("Élément de design invalide.")
            for key, default in (("left", 0), ("top", 0), ("width", 100), ("height", 100), ("scaleX", 1), ("scaleY", 1), ("angle", 0), ("opacity", 1)):
                try:
                    value = float(obj.get(key, default))
                except (TypeError, ValueError):
                    raise ValueError("Paramètre d’élément invalide.")
                if not math.isfinite(value) or abs(value) > 100000:
                    raise ValueError("Valeur de position ou de taille hors limite.")
                if key in ("width", "height") and not 1 <= value <= 6000:
                    raise ValueError("La taille d’un élément doit être comprise entre 1 et 6000 px.")
                if key in ("scaleX", "scaleY") and (value == 0 or abs(value) > 100):
                    raise ValueError("Échelle d’élément invalide.")
                if key == "opacity" and not 0 <= value <= 1:
                    raise ValueError("L’opacité doit être comprise entre 0 et 100 %.")
            if "fontSize" in obj and (not math.isfinite(float(obj["fontSize"])) or not 1 <= float(obj["fontSize"]) <= 2000):
                raise ValueError("Taille de texte invalide.")
            for key in ("brightness", "contrast", "saturation"):
                if key in obj and not 0 <= float(obj[key]) <= 2:
                    raise ValueError("Réglage de filtre invalide.")
            if "text" in obj and (not isinstance(obj["text"], str) or len(obj["text"]) > 10000):
                raise ValueError("Le texte dépasse la longueur maximale.")
            if obj.get("src"):
                source = obj["src"]
                if not isinstance(source, str) or len(source) > 20 * 1024 * 1024:
                    raise ValueError("Source d’image invalide.")
                if not UPLOAD_SOURCE.fullmatch(source) and not DATA_SOURCE.match(source):
                    raise ValueError("Les images doivent provenir de la bibliothèque SANAA.")
    return document

# ---------------------------------------------------------------- image processing
# Copied unchanged from Atelier app/services/image_processing.py.

from PIL import Image, ImageEnhance, ImageFilter, ImageOps  # noqa: E402

MAX_IMAGE_PIXELS = 40_000_000
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


def open_image(source):
    image = Image.open(source)
    if image.format not in ALLOWED_FORMATS:
        raise ValueError("Format d’image non pris en charge.")
    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise ValueError("L’image contient trop de pixels.")
    image.load()
    return ImageOps.exif_transpose(image).convert("RGBA")


def apply_image_settings(image, settings):
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    image = image.convert("RGB")
    if settings.get("grayscale"):
        image = ImageOps.grayscale(image).convert("RGB")
    if settings.get("sepia"):
        gray = ImageOps.grayscale(image)
        image = ImageOps.colorize(gray, "#24180f", "#e7c99b").convert("RGB")
    image = ImageEnhance.Brightness(image).enhance(float(settings.get("brightness", 1)))
    image = ImageEnhance.Contrast(image).enhance(float(settings.get("contrast", 1)))
    image = ImageEnhance.Color(image).enhance(float(settings.get("saturation", 1)))
    image.putalpha(alpha)
    return image


def decode_data_url(value):
    if not value:
        return None
    header, encoded = value.split(",", 1)
    if "base64" not in header:
        raise ValueError("Données image invalides.")
    return Image.open(BytesIO(base64.b64decode(encoded))).convert("RGBA")


# ---------------------------------------------------------------- SVG rasterizer
# Copied unchanged from Atelier app/services/svg.py (dependency-free,
# renders the common uploaded vector artwork).

from PIL import ImageColor, ImageDraw, ImageFont  # noqa: E402

TOKEN = re.compile(r"[A-Za-z]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?")


def _number(value, default=0):
    match = re.match(r"\s*([-+]?(?:\d*\.)?\d+)", str(value or ""))
    return float(match.group(1)) if match else default


def _paint(value, fallback=None):
    if not value or value == "none":
        return fallback
    try:
        return ImageColor.getcolor(value, "RGBA")
    except ValueError:
        return fallback


def _styles(element, inherited):
    result = dict(inherited)
    for key in ("fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity", "font-size"):
        if element.get(key) is not None:
            result[key] = element.get(key)
    for pair in element.get("style", "").split(";"):
        if ":" in pair:
            key, value = pair.split(":", 1)
            result[key.strip()] = value.strip()
    return result


def _matrix(transform):
    matrix = (1, 0, 0, 1, 0, 0)
    for command, raw in re.findall(r"([A-Za-z]+)\s*\(([^)]*)\)", transform or ""):
        values = [float(value) for value in re.findall(r"[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?", raw)]
        if command == "translate":
            if not values:
                raise ValueError("Transformation SVG invalide.")
            current = (1, 0, 0, 1, values[0], values[1] if len(values) > 1 else 0)
        elif command == "scale":
            if not values:
                raise ValueError("Transformation SVG invalide.")
            current = (values[0], 0, 0, values[1] if len(values) > 1 else values[0], 0, 0)
        elif command == "rotate":
            if not values:
                raise ValueError("Transformation SVG invalide.")
            angle = math.radians(values[0])
            cosine, sine = math.cos(angle), math.sin(angle)
            current = (cosine, sine, -sine, cosine, 0, 0)
            if len(values) == 3:
                cx, cy = values[1], values[2]
                current = (cosine, sine, -sine, cosine, cx - cosine * cx + sine * cy, cy - sine * cx - cosine * cy)
        elif command == "matrix" and len(values) == 6:
            current = tuple(values)
        else:
            continue
        a, b, c, d, e, f = matrix
        g, h, i, j, k, l = current
        matrix = (a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f)
    return matrix


def _point(x, y, matrix, sx, sy):
    a, b, c, d, e, f = matrix
    return ((a * x + c * y + e) * sx, (b * x + d * y + f) * sy)


def _path_points(data, matrix, sx, sy):
    tokens = TOKEN.findall(data or "")
    points = []
    index = 0
    command = None
    x = y = start_x = start_y = 0.0
    while index < len(tokens):
        if tokens[index].isalpha():
            command = tokens[index]
            index += 1
            if command in "Zz":
                points.append(_point(start_x, start_y, matrix, sx, sy))
                x, y = start_x, start_y
                continue
        if not command:
            break
        relative = command.islower()
        op = command.upper()
        if op in ("M", "L"):
            if index + 1 >= len(tokens) or tokens[index].isalpha():
                break
            nx, ny = float(tokens[index]), float(tokens[index + 1])
            index += 2
            if relative:
                nx += x
                ny += y
            x, y = nx, ny
            if op == "M":
                start_x, start_y = x, y
                command = "l" if relative else "L"
            points.append(_point(x, y, matrix, sx, sy))
        elif op in ("H", "V"):
            if index >= len(tokens) or tokens[index].isalpha():
                break
            value = float(tokens[index])
            index += 1
            if op == "H":
                x = x + value if relative else value
            else:
                y = y + value if relative else value
            points.append(_point(x, y, matrix, sx, sy))
        elif op in ("C", "Q"):
            count = 6 if op == "C" else 4
            if index + count > len(tokens) or any(value.isalpha() for value in tokens[index:index + count]):
                break
            values = [float(value) for value in tokens[index:index + count]]
            index += count
            if relative:
                values = [value + (x if position % 2 == 0 else y) for position, value in enumerate(values)]
            ox, oy = x, y
            end_x, end_y = values[-2:]
            for step in range(1, 13):
                t = step / 12
                if op == "C":
                    px = (1 - t) ** 3 * ox + 3 * (1 - t) ** 2 * t * values[0] + 3 * (1 - t) * t * t * values[2] + t ** 3 * end_x
                    py = (1 - t) ** 3 * oy + 3 * (1 - t) ** 2 * t * values[1] + 3 * (1 - t) * t * t * values[3] + t ** 3 * end_y
                else:
                    px = (1 - t) ** 2 * ox + 2 * (1 - t) * t * values[0] + t * t * end_x
                    py = (1 - t) ** 2 * oy + 2 * (1 - t) * t * values[1] + t * t * end_y
                points.append(_point(px, py, matrix, sx, sy))
            x, y = end_x, end_y
        else:
            raise ValueError(f"Commande SVG non prise en charge : {command}")
    return points


def render_svg(content, output_size=None):
    try:
        root = ET.fromstring(content)
    except ET.ParseError as error:
        raise ValueError("Document SVG invalide.") from error
    if not root.tag.endswith("svg"):
        raise ValueError("Document SVG invalide.")
    viewbox = [float(value) for value in re.findall(r"[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?", root.get("viewBox", ""))]
    source_width = viewbox[2] if len(viewbox) == 4 else _number(root.get("width"), 512)
    source_height = viewbox[3] if len(viewbox) == 4 else _number(root.get("height"), 512)
    origin_x, origin_y = (viewbox[:2] if len(viewbox) == 4 else (0, 0))
    if source_width <= 0 or source_height <= 0 or source_width * source_height > 100_000_000:
        raise ValueError("Dimensions SVG invalides.")
    if output_size:
        width, height = output_size
    else:
        width, height = int(source_width), int(source_height)
        if max(width, height) > 2048:
            factor = 2048 / max(width, height)
            width, height = max(1, int(width * factor)), max(1, int(height * factor))
    if width <= 0 or height <= 0 or width > 12000 or height > 12000 or width * height > 40_000_000:
        raise ValueError("Rendu SVG trop volumineux.")
    sx, sy = width / source_width, height / source_height
    image = Image.new("RGBA", (max(1, int(width)), max(1, int(height))), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")
    initial = (1, 0, 0, 1, -origin_x, -origin_y)

    def visit(element, inherited, parent_matrix):
        tag = element.tag.rsplit("}", 1)[-1].lower()
        style = _styles(element, inherited)
        a, b, c, d, e, f = parent_matrix
        g, h, i, j, k, l = _matrix(element.get("transform"))
        matrix = (a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f)
        if tag in ("svg", "g", "defs", "title", "desc", "clippath"):
            if tag not in ("defs", "clippath"):
                for child in element:
                    visit(child, style, matrix)
            return
        fill = _paint(style.get("fill", "#000000"))
        stroke = _paint(style.get("stroke"))
        opacity = max(0, min(1, _number(style.get("opacity"), 1) * _number(style.get("fill-opacity"), 1)))
        stroke_opacity = max(0, min(1, _number(style.get("opacity"), 1) * _number(style.get("stroke-opacity"), 1)))
        if fill:
            fill = (*fill[:3], int(fill[3] * opacity))
        if stroke:
            stroke = (*stroke[:3], int(stroke[3] * stroke_opacity))
        line_width = max(1, int(_number(style.get("stroke-width"), 1) * (sx + sy) / 2))
        if tag in ("rect", "image"):
            x, y = _number(element.get("x")), _number(element.get("y"))
            w, h = _number(element.get("width")), _number(element.get("height"))
            p1, p2 = _point(x, y, matrix, sx, sy), _point(x + w, y + h, matrix, sx, sy)
            bounds = (min(p1[0], p2[0]), min(p1[1], p2[1]), max(p1[0], p2[0]), max(p1[1], p2[1]))
            radius = _number(element.get("rx")) * (sx + sy) / 2
            if radius:
                draw.rounded_rectangle(bounds, radius=radius, fill=fill, outline=stroke, width=line_width)
            else:
                draw.rectangle(bounds, fill=fill, outline=stroke, width=line_width)
        elif tag in ("circle", "ellipse"):
            cx, cy, rx = _number(element.get("cx")), _number(element.get("cy")), _number(element.get("r"))
            ry = _number(element.get("ry"), rx)
            p1, p2 = _point(cx - rx, cy - ry, matrix, sx, sy), _point(cx + rx, cy + ry, matrix, sx, sy)
            draw.ellipse((p1[0], p1[1], p2[0], p2[1]), fill=fill, outline=stroke, width=line_width)
        elif tag in ("polygon", "polyline"):
            values = [float(value) for value in re.findall(r"[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?", element.get("points", ""))]
            points = [_point(values[i], values[i + 1], matrix, sx, sy) for i in range(0, len(values) - 1, 2)]
            if len(points) >= 2:
                if tag == "polygon" and fill:
                    draw.polygon(points, fill=fill)
                if stroke:
                    draw.line(points + ([points[0]] if tag == "polygon" else []), fill=stroke, width=line_width)
        elif tag == "line":
            p1 = _point(_number(element.get("x1")), _number(element.get("y1")), matrix, sx, sy)
            p2 = _point(_number(element.get("x2")), _number(element.get("y2")), matrix, sx, sy)
            if stroke:
                draw.line((p1, p2), fill=stroke, width=line_width)
        elif tag == "path":
            points = _path_points(element.get("d", ""), matrix, sx, sy)
            if len(points) >= 2:
                if fill:
                    draw.polygon(points, fill=fill)
                if stroke:
                    draw.line(points, fill=stroke, width=line_width)
        elif tag == "text":
            point = _point(_number(element.get("x")), _number(element.get("y")), matrix, sx, sy)
            font = ImageFont.load_default(size=max(1, int(_number(style.get("font-size"), 16) * sy)))
            draw.text(point, element.text or "", font=font, fill=fill)

    visit(root, {}, initial)
    return image


# ---------------------------------------------------------------- image resolver
# The editor stores images as same-origin serving URLs
# (/api/r2/uploads/<userId>/<uuid>.ext for artworks,
# /api/atelier/file/atelier/uploads/<userId>/<uuid>.ext for editor
# uploads) or as inline data: URLs (abstract compositions). Server-side
# there is no CORS, so every serving URL is resolved to its R2 public
# URL and fetched directly. Nothing is read from local disk.


def resolve_image_url(src):
    if src.startswith("data:"):
        return None  # handled by the caller (decode / render_svg)
    if src.startswith("/api/r2/"):
        key = src[len("/api/r2/"):]
        return f"{R2_PUBLIC_URL}/{key}" if R2_PUBLIC_URL else None
    if src.startswith("/api/atelier/file/"):
        key = src[len("/api/atelier/file/"):]
        return f"{R2_PUBLIC_URL}/{key}" if R2_PUBLIC_URL else None
    if R2_PUBLIC_URL and src.startswith(R2_PUBLIC_URL):
        return src
    return None


def fetch_image(src):
    """Return a Pillow image for an editor image object source."""
    if src.startswith("data:"):
        if "svg+xml" in src[:100]:
            return render_svg(base64.b64decode(src.split(",", 1)[1]))
        return decode_data_url(src)
    url = resolve_image_url(src)
    if not url:
        raise OSError("Source d’image introuvable.")
    request = urllib.request.Request(url, headers={"User-Agent": "SANAA-atelier-export"})
    with urllib.request.urlopen(request, timeout=15) as response:
        content = response.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise ValueError("L’image dépasse la limite de 15 Mo.")
    if src.lower().endswith(".svg") or "svg+xml" in (response.headers.get("Content-Type") or ""):
        return render_svg(content)
    return open_image(BytesIO(content))

# ---------------------------------------------------------------- fonts
# Bundled TTFs (api/atelier/fonts) so the export does not depend on system fonts
# — Vercel's runtime has no DejaVu/Arial. Manrope has no italic face
# (the family ships upright only), so italic Manrope falls back to the
# upright face; DM Sans has real italics.

from reportlab.lib.colors import HexColor  # noqa: E402
from reportlab.lib.utils import ImageReader  # noqa: E402
from reportlab.pdfbase import pdfmetrics  # noqa: E402
from reportlab.pdfbase.ttfonts import TTFont  # noqa: E402
from reportlab.pdfgen import canvas as pdf_canvas  # noqa: E402

_FONT_FILES = {
    ("Manrope", False, False): "Manrope-Regular.ttf",
    ("Manrope", True, False): "Manrope-Bold.ttf",
    ("Manrope", False, True): "Manrope-Regular.ttf",  # no italic face
    ("Manrope", True, True): "Manrope-Bold.ttf",  # no italic face
    ("DM Sans", False, False): "DMSans-Regular.ttf",
    ("DM Sans", True, False): "DMSans-Bold.ttf",
    ("DM Sans", False, True): "DMSans-Italic.ttf",
    ("DM Sans", True, True): "DMSans-BoldItalic.ttf",
    ("DejaVu Sans", False, False): "DejaVuSans.ttf",
    ("DejaVu Sans", True, False): "DejaVuSans-Bold.ttf",
    ("DejaVu Sans", False, True): "DejaVuSans.ttf",
    ("DejaVu Sans", True, True): "DejaVuSans-Bold.ttf",
}
# Editor font names -> bundled family (built-ins stay built-in).
_FONT_FAMILY_MAP = {
    "manrope": "Manrope",
    "dm sans": "DM Sans",
    "georgia": None,  # -> Times-Roman
    "arial": None,  # -> Helvetica
    "times new roman": None,  # -> Times-Roman
    "courier new": None,  # -> Courier
    "trebuchet ms": None,  # -> Helvetica
    "verdana": None,  # -> Helvetica
}
_FONTS_REGISTERED = False


def _register_fonts():
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    _FONTS_REGISTERED = True
    for (family, bold, italic), filename in _FONT_FILES.items():
        path = FONTS_DIR / filename
        if not path.is_file():
            continue
        name = f"{family}{'-Bold' if bold else ''}{'-Italic' if italic and family != 'Manrope' else ''}"
        # Manrope italic falls back to the upright file: keep the same
        # registered name as the upright face so ReportLab finds it.
        if family == "Manrope" and italic:
            name = f"Manrope{'-Bold' if bold else ''}"
        try:
            pdfmetrics.registerFont(TTFont(name, str(path)))
        except Exception:
            pass
    try:
        pdfmetrics.registerFontFamily("Manrope", normal="Manrope", bold="Manrope-Bold", italic="Manrope", boldItalic="Manrope-Bold")
        pdfmetrics.registerFontFamily("DM Sans", normal="DM Sans", bold="DM Sans-Bold", italic="DM Sans-Italic", boldItalic="DM Sans-BoldItalic")
    except Exception:
        pass


def resolve_pdf_font(obj):
    """Map an editor text object to a ReportLab font name."""
    _register_fonts()
    family_raw = str(obj.get("fontFamily", "Manrope") or "Manrope")
    family = _FONT_FAMILY_MAP.get(family_raw.strip().lower(), "Manrope")
    bold = bool(obj.get("bold") or obj.get("fontWeight") == "bold")
    italic = bool(obj.get("fontStyle") == "italic")
    if family is None:
        base = {"georgia": "Times-Roman", "arial": "Helvetica", "times new roman": "Times-Roman", "courier new": "Courier", "trebuchet ms": "Helvetica", "verdana": "Helvetica"}.get(family_raw.strip().lower(), "Helvetica")
        if base == "Times-Roman":
            return "Times-BoldItalic" if bold and italic else "Times-Bold" if bold else "Times-Italic" if italic else "Times-Roman"
        if base == "Courier":
            return "Courier-BoldOblique" if bold and italic else "Courier-Bold" if bold else "Courier-Oblique" if italic else "Courier"
        return "Helvetica-BoldOblique" if bold and italic else "Helvetica-Bold" if bold else "Helvetica-Oblique" if italic else "Helvetica"
    name = f"{family}{'-Bold' if bold else ''}{'-Italic' if italic and family != 'Manrope' else ''}"
    try:
        pdfmetrics.getFont(name)
        return name
    except KeyError:
        return "Helvetica-Bold" if bold else "Helvetica"


def _shadow(obj):
    """Fabric shadow dict, or None. {color, blur, offsetX, offsetY}."""
    shadow = obj.get("shadow")
    if isinstance(shadow, dict) and (shadow.get("offsetX") or shadow.get("offsetY")):
        return shadow
    return None


# ---------------------------------------------------------------- PDF export
# Adapted from Atelier app/services/export_pdf.py. Text and shapes stay
# vectors; photos are embedded rasters. Additions: bundled fonts,
# letterSpacing, lineHeight, underline, italic, and a solid offset
# shadow (ReportLab cannot blur — the shadow is drawn as a solid copy
# offset by (offsetX, -offsetY), never as a screenshot).


def _draw_pdf_text(pdf, obj, w, h, unit_x, unit_y, ghost_color=None):
    fill = ghost_color or obj.get("fill", "#000000")
    size = float(obj.get("fontSize", 32)) * float(obj.get("scaleY", 1)) * unit_y
    font = resolve_pdf_font(obj)
    line_height = float(obj.get("lineHeight", 1.2))
    letter_spacing = float(obj.get("letterSpacing", 0)) * unit_x
    # Character spacing lives on the text object, not the canvas.
    text_obj = pdf.beginText()
    text_obj.setFont(font, size)
    text_obj.setFillColor(HexColor(fill))
    if letter_spacing:
        text_obj.setCharSpace(letter_spacing)
    for idx, line in enumerate(str(obj.get("text", "")).splitlines()):
        line_width = pdf.stringWidth(line, font, size)
        if letter_spacing and len(line) > 1:
            line_width += letter_spacing * (len(line) - 1)
        text_align = obj.get("textAlign", "left")
        text_x = -w / 2 if text_align == "left" else (w - line_width) / 2 if text_align == "center" else w / 2 - line_width
        baseline = h / 2 - size * line_height * idx - size
        text_obj.setTextOrigin(text_x, baseline)
        text_obj.textOut(line)
        if obj.get("underline"):
            pdf.setStrokeColor(HexColor(fill))
            pdf.setLineWidth(max(0.5, size * 0.06))
            pdf.line(text_x, baseline - size * 0.12, text_x + line_width, baseline - size * 0.12)
    pdf.drawText(text_obj)


def _draw_pdf_shape(pdf, obj, w, h, unit_x, unit_y, ghost_color=None):
    kind = obj.get("type", "").lower()
    fill = ghost_color or obj.get("fill", "#000000")
    pdf.setFillColor(HexColor(fill))
    stroke = None if ghost_color else obj.get("stroke")
    if stroke and float(obj.get("strokeWidth", 0)):
        pdf.setStrokeColor(HexColor(stroke))
        pdf.setLineWidth(float(obj.get("strokeWidth", 1)) * (unit_x + unit_y) / 2)
    if kind in ("circle", "ellipse"):
        pdf.ellipse(-w / 2, -h / 2, w / 2, h / 2, fill=1, stroke=bool(stroke))
    elif kind == "triangle":
        path = pdf.beginPath()
        path.moveTo(0, h / 2)
        path.lineTo(w / 2, -h / 2)
        path.lineTo(-w / 2, -h / 2)
        path.close()
        pdf.drawPath(path, fill=1, stroke=bool(stroke))
    elif kind in ("polygon", "polyline") and obj.get("points"):
        path = pdf.beginPath()
        points = obj["points"]
        path.moveTo(-w / 2 + float(points[0].get("x", 0)) * unit_x, h / 2 - float(points[0].get("y", 0)) * unit_y)
        for point in points[1:]:
            path.lineTo(-w / 2 + float(point.get("x", 0)) * unit_x, h / 2 - float(point.get("y", 0)) * unit_y)
        if kind == "polygon":
            path.close()
        pdf.drawPath(path, fill=1 if kind == "polygon" else 0, stroke=1)
    elif kind in ("line", "arrow"):
        pdf.line(-w / 2, 0, w / 2, 0)
    else:
        pdf.roundRect(-w / 2, -h / 2, w, h, float(obj.get("rx", 0)) * unit_x, fill=1, stroke=bool(stroke))


def _draw_pdf_image(pdf, obj, w, h, unit_x, unit_y, ghost_color=None):
    if ghost_color:
        # A photo's shadow is a solid rectangle in the shadow colour.
        pdf.setFillColor(HexColor(ghost_color))
        pdf.rect(-w / 2, -h / 2, w, h, fill=1, stroke=0)
        return
    try:
        src = obj.get("src", "")
        image = fetch_image(src)
        image = apply_image_settings(image, obj)
        image = image.convert("RGBA")
        opacity = max(0, min(1, float(obj.get("opacity", 1))))
        if opacity < 1:
            image.putalpha(image.getchannel("A").point(lambda value: int(value * opacity)))
        radius = int(float(obj.get("cornerRadius", 0)) * image.width / max(1, float(obj.get("width", image.width))))
        if radius:
            mask = Image.new("L", image.size, 0)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width - 1, image.height - 1), radius, fill=255)
            image.putalpha(mask)
        pdf.drawImage(ImageReader(image), -w / 2, -h / 2, w, h, mask="auto")
        if obj.get("stroke") and float(obj.get("strokeWidth", 0)):
            pdf.setStrokeColor(HexColor(obj["stroke"]))
            pdf.setLineWidth(float(obj["strokeWidth"]) * (unit_x + unit_y) / 2)
            pdf.roundRect(-w / 2, -h / 2, w, h, radius * unit_x, fill=0, stroke=1)
    except (OSError, ValueError):
        pdf.setFillColor(HexColor("#e7e5e4"))
        pdf.rect(-w / 2, -h / 2, w, h, fill=1, stroke=0)


def _draw_pdf_object(pdf, obj, w, h, unit_x, unit_y, ghost_color=None):
    kind = obj.get("type", "").lower()
    if kind in ("i-text", "textbox", "text"):
        _draw_pdf_text(pdf, obj, w, h, unit_x, unit_y, ghost_color)
    elif kind in ("image", "path") and (obj.get("src") or obj.get("data")):
        _draw_pdf_image(pdf, obj, w, h, unit_x, unit_y, ghost_color)
    else:
        _draw_pdf_shape(pdf, obj, w, h, unit_x, unit_y, ghost_color)


def export_pdf(project):
    pages = project.get("pages") or [project]
    output = BytesIO()
    pdf = pdf_canvas.Canvas(output, pageCompression=1)
    for page in pages:
        page_width = float(page.get("width", 1080))
        page_height = float(page.get("height", 1080))
        width = float(page.get("physicalWidthMm", page_width * 25.4 / 96)) * 72 / 25.4
        height = float(page.get("physicalHeightMm", page_height * 25.4 / 96)) * 72 / 25.4
        unit_x, unit_y = width / page_width, height / page_height
        pdf.setPageSize((width, height))
        if page.get("background", "#ffffff") != "transparent":
            pdf.setFillColor(HexColor(page.get("background", "#ffffff")))
            pdf.rect(0, 0, width, height, fill=1, stroke=0)
        for obj in page.get("objects", []):
            left = float(obj.get("left", 0)) * unit_x
            top = height - float(obj.get("top", 0)) * unit_y
            w = float(obj.get("width", 100)) * float(obj.get("scaleX", 1)) * unit_x
            h = float(obj.get("height", 100)) * float(obj.get("scaleY", 1)) * unit_y
            pdf.saveState()
            pdf.translate(left + w / 2, top - h / 2)
            pdf.rotate(-float(obj.get("angle", 0)))
            if hasattr(pdf, "setFillAlpha"):
                pdf.setFillAlpha(min(1, max(0, float(obj.get("opacity", 1)))))
            shadow = _shadow(obj)
            if shadow:
                # Solid offset copy first (no blur — ReportLab cannot blur).
                try:
                    shadow_color = str(shadow.get("color", "#000000"))
                    offset_x = float(shadow.get("offsetX", 0)) * unit_x
                    offset_y = float(shadow.get("offsetY", 0)) * unit_y
                    pdf.saveState()
                    pdf.translate(offset_x, -offset_y)
                    _draw_pdf_object(pdf, obj, w, h, unit_x, unit_y, ghost_color=shadow_color)
                    pdf.restoreState()
                except (ValueError, TypeError):
                    pass
            _draw_pdf_object(pdf, obj, w, h, unit_x, unit_y)
            pdf.restoreState()
        pdf.showPage()
    pdf.save()
    return output.getvalue()

# ---------------------------------------------------------------- raster export
# Adapted from Atelier app/services/export_image.py. Changes: fonts come
# from the bundled api/atelier/fonts directory (the original fell back to a tiny
# bitmap font on servers without DejaVu), letter-spacing is drawn
# character by character, and shadows get the same solid offset copy
# as in the PDF renderer.


def _raster_font(size, family="Manrope", bold=False, italic=False):
    candidates = []
    key = (family, bold, italic if family != "Manrope" else False)
    filename = _FONT_FILES.get(key)
    if filename:
        candidates.append(FONTS_DIR / filename)
    candidates.append(FONTS_DIR / "DejaVuSans-Bold.ttf" if bold else FONTS_DIR / "DejaVuSans.ttf")
    for candidate in candidates:
        try:
            return ImageFont.truetype(str(candidate), max(1, int(size)))
        except OSError:
            continue
    return ImageFont.load_default()


def _color(value, default=(0, 0, 0, 255)):
    if not isinstance(value, str) or not value.startswith("#"):
        return default
    raw = value[1:]
    try:
        if len(raw) == 3:
            raw = "".join(char * 2 for char in raw)
        if len(raw) == 6:
            return tuple(bytes.fromhex(raw)) + (255,)
    except ValueError:
        pass
    return default


def _draw_raster_text(draw, obj, element, margin, width, height, scale, ghost_color=None):
    text = str(obj.get("text", ""))
    size = float(obj.get("fontSize", 32)) * float(obj.get("scaleY", 1)) * scale
    font = _raster_font(size, str(obj.get("fontFamily", "Manrope") or "Manrope"), bool(obj.get("fontWeight") == "bold" or obj.get("bold")), bool(obj.get("fontStyle") == "italic"))
    fill = _color(ghost_color or obj.get("fill", "#000000"))
    letter_spacing = float(obj.get("letterSpacing", 0)) * scale
    line_height = int(float(obj.get("fontSize", 32)) * float(obj.get("lineHeight", 1.2)) * scale)
    lines = text.splitlines() or [""]
    for index, line in enumerate(lines):
        y = margin + index * line_height
        align = obj.get("textAlign", "left")
        if letter_spacing:
            total = sum(font.getlength(ch) for ch in line) + letter_spacing * max(0, len(line) - 1)
            start_x = margin if align == "left" else margin + (width - total) / 2 if align == "center" else margin + width - total
            x = start_x
            for ch in line:
                draw.text((x, y), ch, font=font, fill=fill)
                x += font.getlength(ch) + letter_spacing
            underline_width = total
        else:
            start_x = margin if align == "left" else margin + (width - font.getlength(line)) / 2 if align == "center" else margin + width - font.getlength(line)
            draw.text((start_x, y), line, font=font, fill=fill)
            underline_width = font.getlength(line)
        if obj.get("underline") and not ghost_color:
            draw.line((start_x, y + int(size * 1.05), start_x + underline_width, y + int(size * 1.05)), fill=fill, width=max(1, int(scale)))


def _render_object(obj, scale, ghost_color=None):
    width = max(1, int(float(obj.get("width", 100)) * float(obj.get("scaleX", 1)) * scale))
    height = max(1, int(float(obj.get("height", 100)) * float(obj.get("scaleY", 1)) * scale))
    if width > 12000 or height > 12000 or width * height > 40_000_000:
        raise ValueError("Cet élément est trop grand pour être exporté.")
    kind = obj.get("type", "rect").lower()
    shadow = _shadow(obj)
    extra = 0
    if shadow and not ghost_color:
        extra = int(max(abs(float(shadow.get("offsetX", 0))), abs(float(shadow.get("offsetY", 0)))) * scale) + 2
    margin = 4 + extra
    element = Image.new("RGBA", (width + margin * 2, height + margin * 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(element)
    fill = _color(ghost_color or obj.get("fill", "#000000"))
    stroke = _color(obj.get("stroke", "#000000"))
    stroke_width = 0 if ghost_color else max(0, int(float(obj.get("strokeWidth", 0)) * scale))
    box = (margin, margin, margin + width - 1, margin + height - 1)

    if shadow and not ghost_color:
        # Shadow first (behind the shape): solid offset copy, no blur.
        ghost = _render_object(obj, scale, ghost_color=str(shadow.get("color", "#000000")))
        offset_x = int(float(shadow.get("offsetX", 0)) * scale)
        offset_y = int(float(shadow.get("offsetY", 0)) * scale)
        element.alpha_composite(ghost, (extra + offset_x, extra + offset_y))

    if kind in ("image", "path") and (obj.get("src") or obj.get("data")):
        if ghost_color:
            draw.rectangle(box, fill=fill)
        else:
            try:
                image = fetch_image(obj.get("src", ""))
                image = apply_image_settings(image, obj)
                image = ImageOps.fit(image, (width, height))
                radius = int(float(obj.get("rx", obj.get("cornerRadius", 0))) * scale)
                if radius:
                    mask = Image.new("L", (width, height), 0)
                    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius, fill=255)
                    image.putalpha(mask)
                element.alpha_composite(image, (margin, margin))
                if stroke_width:
                    draw.rounded_rectangle(box, radius=radius, outline=stroke, width=stroke_width)
            except (OSError, ValueError, Image.DecompressionBombError):
                draw.rectangle(box, fill="#e7e5e4", outline="#a8a29e", width=2)
    elif kind in ("i-text", "textbox", "text"):
        _draw_raster_text(draw, obj, element, margin, width, height, scale, ghost_color)
    elif kind in ("circle", "ellipse"):
        draw.ellipse(box, fill=fill, outline=stroke if stroke_width else None, width=stroke_width)
    elif kind in ("triangle", "triangle-shape"):
        draw.polygon(((margin + width / 2, margin), (margin + width, margin + height), (margin, margin + height)), fill=fill, outline=stroke if stroke_width else None)
    elif kind in ("polygon", "polyline") and obj.get("points"):
        points = [
            (
                margin + float(point.get("x", 0)) * width / max(1, float(obj.get("width", 100))),
                margin + float(point.get("y", 0)) * height / max(1, float(obj.get("height", 100))),
            )
            for point in obj["points"]
        ]
        if kind == "polyline":
            draw.line(points, fill=stroke if stroke_width else fill, width=max(1, stroke_width))
        else:
            draw.polygon(points, fill=fill, outline=stroke if stroke_width else None)
    elif kind in ("line", "arrow"):
        draw.line((margin, margin + height / 2, margin + width, margin + height / 2), fill=stroke if stroke_width else fill, width=max(1, stroke_width))
        if kind == "arrow":
            size = max(8, int(height * 0.25))
            draw.polygon(((margin + width, margin + height / 2), (margin + width - size, margin + height / 2 - size), (margin + width - size, margin + height / 2 + size)), fill=fill)
    elif kind in ("star",):
        points = []
        for i in range(10):
            radius = (min(width, height) / 2) * (1 if i % 2 == 0 else 0.45)
            angle = -math.pi / 2 + i * math.pi / 5
            points.append((margin + width / 2 + radius * math.cos(angle), margin + height / 2 + radius * math.sin(angle)))
        draw.polygon(points, fill=fill, outline=stroke if stroke_width else None)
    else:
        radius = int(float(obj.get("rx", obj.get("cornerRadius", 0))) * scale)
        if radius:
            draw.rounded_rectangle(box, radius=radius, fill=fill, outline=stroke if stroke_width else None, width=stroke_width)
        else:
            draw.rectangle(box, fill=fill, outline=stroke if stroke_width else None, width=stroke_width)

    opacity = min(1.0, max(0.0, float(obj.get("opacity", 1))))
    if opacity < 1:
        element.putalpha(element.getchannel("A").point(lambda value: int(value * opacity)))
    angle = float(obj.get("angle", 0))
    if angle:
        element = element.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    return element


def render_page(page, scale=2):
    width = max(1, int(float(page.get("width", 1080)) * scale))
    height = max(1, int(float(page.get("height", 1080)) * scale))
    if width > 24000 or height > 24000 or width * height > 80_000_000:
        raise ValueError("La page dépasse la limite de taille pour le rendu.")
    background = page.get("background", "#ffffff")
    canvas = Image.new("RGBA", (width, height), _color(background, (255, 255, 255, 0)) if background != "transparent" else (0, 0, 0, 0))
    for obj in page.get("objects", []):
        element = _render_object(obj, scale)
        x = float(obj.get("left", 0)) * scale + float(obj.get("width", 100)) * float(obj.get("scaleX", 1)) * scale / 2 - element.width / 2
        y = float(obj.get("top", 0)) * scale + float(obj.get("height", 100)) * float(obj.get("scaleY", 1)) * scale / 2 - element.height / 2
        canvas.alpha_composite(element, (int(x), int(y)))
    return canvas


def export_raster(project, fmt="JPEG", dpi=150):
    page = project.get("pages", [project])[0]
    physical_width = page.get("physicalWidthMm")
    scale = float(physical_width) * dpi / 25.4 / float(page.get("width", 1080)) if physical_width else dpi / 96
    scale = max(1, min(4, scale))
    if float(page.get("width", 1080)) * float(page.get("height", 1080)) * scale * scale > 80_000_000:
        raise ValueError("La page est trop grande pour être exportée en image.")
    image = render_page(page, scale)
    output = BytesIO()
    if fmt.upper() in ("JPG", "JPEG"):
        if image.mode == "RGBA":
            background = Image.new("RGB", image.size, "white")
            background.paste(image, mask=image.getchannel("A"))
            image = background
        image.save(output, "JPEG", quality=95, dpi=(dpi, dpi), optimize=True)
    else:
        image.save(output, "PNG", dpi=(dpi, dpi), optimize=True)
    return output.getvalue()


# ---------------------------------------------------------------- FastAPI app
# Publication feed (api/social.py): mounted on this same app, NOT a second
# FastAPI app. Vercel serves this file for both /api/atelier/export/* and
# /api/social/* (see the rewrites in vercel.json); the routes are declared
# at their full public paths, which is what the ASGI app sees after the
# rewrite. The standalone `app` object in api/social.py is the scaffold's
# own app, kept only so the scaffold tests can import it — it is not served.
# The `api.*` imports below need the repo root on sys.path; Vercel does not
# guarantee it, so add it explicitly (no-op locally / in the scaffold tests,
# where the root is already on the path).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.exc import SQLAlchemyError  # noqa: E402
from api.social import handle_database_error, router as social_router  # noqa: E402

app = FastAPI(title="SANAA Atelier export", version="1.0.0")
app.include_router(social_router)
# Same DB-error mapping as the scaffold's standalone app (503, not 500).
app.add_exception_handler(SQLAlchemyError, handle_database_error)


@app.get("/api/atelier/export/health")
async def health():
    return {"status": "ok"}


def _export(format_name: str, project: dict, request: Request):
    user_id = verify_session(request)
    if not user_id:
        return JSONResponse({"detail": "Connectez-vous pour exporter."}, status_code=401)
    fmt = format_name.lower()
    if fmt not in ("pdf", "jpg", "jpeg", "png"):
        return JSONResponse({"detail": "Format d’export non pris en charge."}, status_code=400)
    try:
        validate_document(project)
    except ValueError as error:
        return JSONResponse({"detail": str(error)}, status_code=422)
    name = re.sub(r"[^a-zA-Z0-9_-]+", "-", project.get("name", "design")).strip("-") or "design"
    try:
        if fmt == "pdf":
            body = export_pdf(project)
            media = "application/pdf"
            extension = "pdf"
        else:
            extension = "jpg" if fmt in ("jpg", "jpeg") else "png"
            body = export_raster(project, "JPEG" if extension == "jpg" else "PNG", int(project.get("exportDpi", 300)))
            media = "image/jpeg" if extension == "jpg" else "image/png"
    except (OSError, ValueError, KeyError) as error:
        return JSONResponse({"detail": f"Impossible de créer l’export : {error}"}, status_code=422)
    return Response(body, media_type=media, headers={"Content-Disposition": f'attachment; filename="{name}.{extension}"'})


# ---------------------------------------------------------------- certificate PDF
# Server-side PDF for the Certificate Studio, rendered by the same
# Python function as the Atelier exports (same auth, same bundled
# fonts). The browser print dialog stays available; this route gives a
# real one-page PDF download instead. The QR code is drawn from the
# `qrcode` package (pure Python, Pillow only); if the package is ever
# missing the PDF still renders, with the certificate ID in text.
# The artwork image is fetched from R2 exactly like Atelier images
# (fetch_image); a missing image is skipped, never fatal.

_CERT_TEMPLATES = {
    # id: (align, kicker_spacing, title_size, ornament)
    "classic": ("center", 3.0, 30, "double-rule"),
    "minimal": ("left", 2.0, 26, "thin-rule"),
    "gallery": ("center", 3.0, 30, "double-rule"),
    "heritage": ("center", 3.5, 30, "corners"),
    "modern": ("left", 2.5, 32, "top-bar"),
    "noir": ("center", 3.5, 30, "gold-rule"),
    "deco": ("center", 4.0, 30, "diamonds"),
    "monogram": ("center", 3.0, 30, "watermark"),
    "ledger": ("left", 1.5, 26, "ruled"),
    "ribbon": ("center", 3.0, 30, "band"),
}


def _wrap(text, font, size, max_width, pdf):
    words = str(text or "").split()
    lines, current = [], ""
    for word in words:
        trial = f"{current} {word}".strip()
        if pdf.stringWidth(trial, font, size) <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


def export_certificate_pdf(cfg):
    _register_fonts()
    paper = str(cfg.get("paperSize", "A4")).upper()
    landscape = str(cfg.get("orientation", "portrait")) == "landscape"
    page_w, page_h = (841.89, 595.27) if paper == "A4" and landscape else (595.27, 841.89) if paper == "A4" else (792.0, 612.0) if landscape else (612.0, 792.0)
    template = str(cfg.get("template", "classic"))
    align, kicker_spacing, title_size, ornament = _CERT_TEMPLATES.get(template, _CERT_TEMPLATES["classic"])
    gold = "#b08d3e" if cfg.get("goldAccent", True) else "#1a1a1a"
    dark = template == "noir"
    ink = "#f5f2eb" if dark else "#1a1a1a"
    muted = "#c9b896" if dark else "#666666"
    paper_bg = "#141210" if dark else "#fdfdfc"
    border = str(cfg.get("border", "double"))
    margin = 54.0
    inner_w = page_w - margin * 2

    output = BytesIO()
    pdf = pdf_canvas.Canvas(output, pageCompression=1)
    pdf.setPageSize((page_w, page_h))
    pdf.setFillColor(HexColor(paper_bg))
    pdf.rect(0, 0, page_w, page_h, fill=1, stroke=0)

    # -- frame ------------------------------------------------------------
    frame = gold if border == "gold" else ink
    if border in ("single", "gold"):
        pdf.setStrokeColor(HexColor(frame))
        pdf.setLineWidth(1)
        pdf.rect(margin - 18, margin - 18, page_w - (margin - 18) * 2, page_h - (margin - 18) * 2, fill=0, stroke=1)
    elif border == "double":
        pdf.setStrokeColor(HexColor(frame))
        pdf.setLineWidth(2.2)
        pdf.rect(margin - 18, margin - 18, page_w - (margin - 18) * 2, page_h - (margin - 18) * 2, fill=0, stroke=1)
        pdf.setLineWidth(0.6)
        pdf.rect(margin - 11, margin - 11, page_w - (margin - 11) * 2, page_h - (margin - 11) * 2, fill=0, stroke=1)
    if ornament == "corners":
        pdf.setStrokeColor(HexColor(gold))
        pdf.setLineWidth(0.8)
        for cx, cy, sx, sy in ((margin, page_h - margin, 1, -1), (page_w - margin, page_h - margin, -1, -1), (margin, margin, 1, 1), (page_w - margin, margin, -1, 1)):
            pdf.line(cx, cy, cx + 26 * sx, cy)
            pdf.line(cx, cy, cx, cy + 26 * sy)
    if ornament == "top-bar":
        pdf.setFillColor(HexColor(ink))
        pdf.rect(margin, page_h - margin - 10, inner_w, 10, fill=1, stroke=0)
    if ornament == "band":
        pdf.setFillColor(HexColor(gold))
        pdf.rect(0, page_h - 64, page_w, 64, fill=1, stroke=0)
    if ornament == "diamonds":
        pdf.setFillColor(HexColor(gold))
        for dx in (page_w / 2 - 90, page_w / 2, page_w / 2 + 90):
            path = pdf.beginPath()
            path.moveTo(dx, page_h - margin - 6)
            path.lineTo(dx + 5, page_h - margin - 1)
            path.lineTo(dx, page_h - margin + 4)
            path.lineTo(dx - 5, page_h - margin - 1)
            path.close()
            pdf.drawPath(path, fill=1, stroke=0)

    y = page_h - margin - 34
    if ornament == "band":
        y = page_h - 92
    x0 = margin if align == "left" else 0

    def text_line(text, font, size, yy, color=None, spacing=0.0, centered=None):
        use_center = align == "center" if centered is None else centered
        width = pdf.stringWidth(text, font, size) + spacing * max(0, len(text) - 1)
        x = (page_w - width) / 2 if use_center else x0
        if spacing:
            # Character spacing lives on the text object, not the canvas.
            text_obj = pdf.beginText()
            text_obj.setFont(font, size)
            text_obj.setFillColor(HexColor(color or ink))
            text_obj.setCharSpace(spacing)
            text_obj.setTextOrigin(x, yy)
            text_obj.textOut(text)
            pdf.drawText(text_obj)
        else:
            pdf.setFont(font, size)
            pdf.setFillColor(HexColor(color or ink))
            pdf.drawString(x, yy, text)
        return yy

    # -- monogram watermark ------------------------------------------------
    if ornament == "watermark":
        initial = (str(cfg.get("artist", "")).strip() or "A")[:1].upper()
        pdf.saveState()
        pdf.setFont("Times-Roman", 300)
        pdf.setFillColor(HexColor("#f0ede6" if not dark else "#221e1a"))
        pdf.drawCentredString(page_w / 2, page_h / 2 - 90, initial)
        pdf.restoreState()

    # -- kicker ------------------------------------------------------------
    kicker_color = "#f5f2eb" if ornament == "band" else gold
    text_line("CERTIFICATE OF AUTHENTICITY", "Helvetica-Bold", 11, y, kicker_color, kicker_spacing)
    y -= 26

    # -- artwork image ------------------------------------------------------
    image_url = str(cfg.get("imageUrl") or "")
    show_image = bool(cfg.get("showImage", True)) and bool(image_url)
    if show_image:
        try:
            image = fetch_image(image_url).convert("RGB")
            max_w = inner_w if template == "gallery" else min(inner_w, 340)
            max_h = 210 if template == "gallery" else 150
            scale = min(max_w / image.width, max_h / image.height, 1)
            iw, ih = image.width * scale, image.height * scale
            ix = (page_w - iw) / 2 if align == "center" else x0
            pdf.drawImage(ImageReader(image), ix, y - ih, iw, ih, mask="auto")
            y -= ih + 22
        except Exception:
            pass

    # -- title + artist ------------------------------------------------------
    for line in _wrap(cfg.get("title") or "Untitled", "Times-Bold", title_size, inner_w, pdf):
        text_line(line, "Times-Bold", title_size, y)
        y -= title_size + 6
    y -= 2
    text_line(str(cfg.get("artist", "")), "Helvetica", 13, y, muted)
    y -= 34

    # -- details --------------------------------------------------------------
    edition_n = str(cfg.get("editionNumber", "1") or "1").strip()
    edition_size = str(cfg.get("editionSize", "1") or "1").strip()
    edition = f"{edition_n} / 1 — unique work" if edition_size == "1" else f"No. {edition_n} of {edition_size}"
    rows = [
        ("Medium", str(cfg.get("medium") or "—")),
        ("Dimensions", str(cfg.get("dimensions") or "—")),
        ("Year", str(cfg.get("year") or "—")),
        ("Edition", edition),
        ("Certificate ID", str(cfg.get("certificateId") or "—")),
    ]
    pdf.setStrokeColor(HexColor(gold if ornament != "thin-rule" else ink))
    pdf.setLineWidth(0.7)
    if align == "center":
        pdf.line(page_w / 2 - 60, y + 12, page_w / 2 + 60, y + 12)
    for label, value in rows:
        pdf.setFont("Helvetica-Bold", 9)
        pdf.setFillColor(HexColor(muted))
        if align == "center":
            label_width = pdf.stringWidth(label.upper(), "Helvetica-Bold", 9)
            pdf.drawString((page_w - label_width) / 2, y, label.upper())
        else:
            pdf.drawString(x0, y, label.upper())
        pdf.setFont("Helvetica", 11)
        pdf.setFillColor(HexColor(ink))
        if align == "center":
            value_width = pdf.stringWidth(value, "Helvetica", 11)
            pdf.drawString((page_w - value_width) / 2, y - 15, value)
            y -= 32
        else:
            pdf.drawString(x0, y - 15, value)
            y -= 32
        if ornament == "ruled":
            pdf.setStrokeColor(HexColor("#d8d2c4"))
            pdf.setLineWidth(0.5)
            pdf.line(x0, y + 6, x0 + inner_w, y + 6)

    # -- certification paragraph ----------------------------------------------
    y -= 8
    issue = str(cfg.get("issueDate") or "")
    try:
        from datetime import date as _date

        parts = issue.split("-")
        pretty = _date(int(parts[0]), int(parts[1]), int(parts[2])).strftime("%d %B %Y") if len(parts) == 3 else issue
    except Exception:
        pretty = issue
    statement = (
        f"This document certifies that the work described above is an original work by "
        f"{cfg.get('artist', '')}, issued in {cfg.get('place', '')} on {pretty}."
    )
    for line in _wrap(statement, "Helvetica", 11, inner_w, pdf):
        text_line(line, "Helvetica", 11, y)
        y -= 17

    # -- signature + stamp -----------------------------------------------------
    y = max(y - 14, 150)
    sig = str(cfg.get("signatureText") or "")
    if sig:
        text_line(sig, "Times-Italic", 22, y)
        y -= 8
    pdf.setStrokeColor(HexColor(ink))
    pdf.setLineWidth(0.7)
    sig_w = inner_w / 2 - 30
    sx = (page_w - sig_w) / 2 if align == "center" else x0
    pdf.line(sx, y, sx + sig_w, y)
    y -= 16
    text_line(f"{cfg.get('signatureName', '')} — Artist", "Helvetica", 10, y, muted)
    y -= 14
    text_line(f"{cfg.get('place', '')} — {pretty}", "Helvetica", 10, y, muted)
    if ornament == "ruled":
        pdf.setStrokeColor(HexColor(ink))
        pdf.setLineWidth(1)
        pdf.rect(page_w - margin - 110, 118, 110, 52, fill=0, stroke=1)
        pdf.setFont("Helvetica-Bold", 11)
        pdf.setFillColor(HexColor(ink))
        pdf.drawCentredString(page_w - margin - 55, 142, "ORIGINAL")

    # -- verification note + QR --------------------------------------------------
    note = str(cfg.get("verificationNote") or "")
    note_lines = _wrap(note, "Helvetica", 8.5, inner_w - 130, pdf)
    ny = 108
    for line in note_lines[:4]:
        pdf.setFont("Helvetica", 8.5)
        pdf.setFillColor(HexColor(muted))
        pdf.drawString(x0, ny, line)
        ny -= 12
    pdf.setFont("Helvetica-Bold", 8.5)
    pdf.setFillColor(HexColor(ink))
    pdf.drawString(x0, ny, f"Certificate ID: {cfg.get('certificateId', '')}")

    payload = (
        f"Certificate of Authenticity {cfg.get('certificateId', '')}\n"
        f"\"{cfg.get('title', '')}\" by {cfg.get('artist', '')}, {cfg.get('year', '')}\n"
        f"{cfg.get('medium', '')}, {cfg.get('dimensions', '')}\n"
        f"Edition {edition}\nVerify this certificate ID against the artist's records."
    )
    try:
        import qrcode as qr_lib

        qr = qr_lib.QRCode(border=1)
        qr.add_data(payload)
        qr.make()
        qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
        pdf.drawImage(ImageReader(qr_img), page_w - margin - 84, 52, 84, 84, mask="auto")
        pdf.setFont("Helvetica", 8)
        pdf.setFillColor(HexColor(muted))
        pdf.drawCentredString(page_w - margin - 42, 44, "Scan to verify")
    except Exception:
        pass

    pdf.showPage()
    pdf.save()
    return output.getvalue()


@app.post("/api/atelier/export/certificate")
async def export_certificate(request: Request):
    user_id = verify_session(request)
    if not user_id:
        return JSONResponse({"detail": "Connectez-vous pour exporter."}, status_code=401)
    try:
        cfg = await request.json()
    except Exception:
        return JSONResponse({"detail": "Document invalide."}, status_code=422)
    if not isinstance(cfg, dict) or not str(cfg.get("title") or "").strip():
        return JSONResponse({"detail": "Le certificat doit avoir un titre."}, status_code=422)
    try:
        body = export_certificate_pdf(cfg)
    except (OSError, ValueError, KeyError) as error:
        return JSONResponse({"detail": f"Impossible de créer le certificat : {error}"}, status_code=422)
    name = re.sub(r"[^a-zA-Z0-9_-]+", "-", str(cfg.get("certificateId") or "certificate")).strip("-") or "certificate"
    return Response(body, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'})


@app.post("/api/atelier/export/{format_name}")
async def export_document(format_name: str, request: Request):
    try:
        project = await request.json()
    except Exception:
        return JSONResponse({"detail": "Document invalide."}, status_code=422)
    if not isinstance(project, dict):
        return JSONResponse({"detail": "Document invalide."}, status_code=422)
    return _export(format_name, project, request)
