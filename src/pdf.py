from __future__ import annotations

from datetime import datetime
from pathlib import Path

import matplotlib
from fpdf import FPDF

from .config import OUTPUT_DIR

EU_BLUE = (0, 51, 153)

MONTHS_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]


def _fr_date() -> str:
    n = datetime.now()
    return f"{n.day} {MONTHS_FR[n.month - 1]} {n.year}"


_MPL_FONTS = Path(matplotlib.__file__).parent / "mpl-data" / "fonts" / "ttf"
FONT_REGULAR = _MPL_FONTS / "DejaVuSans.ttf"
FONT_BOLD = _MPL_FONTS / "DejaVuSans-Bold.ttf"
FONT_ITALIC = _MPL_FONTS / "DejaVuSans-Oblique.ttf"


class ReportPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.add_font("DejaVu", "", str(FONT_REGULAR))
        self.add_font("DejaVu", "B", str(FONT_BOLD))
        self.add_font("DejaVu", "I", str(FONT_ITALIC))

    def header(self):
        self.set_fill_color(*EU_BLUE)
        self.rect(0, 0, 210, 6, "F")
        self.ln(10)
        self.set_text_color(0, 0, 0)

    def footer(self):
        self.set_y(-14)
        self.set_font("DejaVu", "I", 7)
        self.set_text_color(120, 120, 120)
        self.cell(0, 6, f"IMT × IDUN · {_fr_date()}", align="C")


def build_report(spec: dict, chart_paths: list[str]) -> Path:
    pdf = ReportPDF()
    pdf.set_auto_page_break(True, margin=20)
    pdf.add_page()

    pdf.set_font("DejaVu", "B", 18)
    pdf.set_text_color(*EU_BLUE)
    pdf.multi_cell(0, 9, spec.get("title", "Analysis report"))
    pdf.ln(1)

    pdf.set_font("DejaVu", "", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 5, _fr_date(), ln=True)
    pdf.ln(3)

    pdf.set_font("DejaVu", "B", 11)
    pdf.set_text_color(*EU_BLUE)
    pdf.cell(0, 7, "Résumé exécutif", ln=True)
    pdf.set_font("DejaVu", "", 10)
    pdf.set_text_color(30, 30, 30)
    pdf.multi_cell(0, 5.5, spec.get("executive_summary", ""))
    pdf.ln(4)

    charts = iter(chart_paths)
    for section in spec.get("sections", []):
        if pdf.get_y() > 230:
            pdf.add_page()
        pdf.set_font("DejaVu", "B", 12)
        pdf.set_text_color(*EU_BLUE)
        pdf.cell(0, 7, section.get("heading", ""), ln=True)
        pdf.set_font("DejaVu", "", 10)
        pdf.set_text_color(30, 30, 30)
        pdf.multi_cell(0, 5.5, section.get("body", ""))
        pdf.ln(2)
        chart = next(charts, None)
        if chart:
            try:
                pdf.image(chart, w=170)
                pdf.ln(3)
            except Exception:
                pass

    for chart in charts:
        pdf.add_page()
        try:
            pdf.image(chart, w=180)
        except Exception:
            pass

    path = OUTPUT_DIR / f"report_{datetime.now():%Y%m%d_%H%M%S}.pdf"
    pdf.output(str(path))
    return path
