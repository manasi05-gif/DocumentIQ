"""
Generates clean, professionally formatted Microsoft Word (.docx) documents
from markdown content, summaries, notes, or quiz questions.
"""

import io
import re
from datetime import datetime
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE


def create_docx(title: str, content: str, subtitle: str = "DocumentIQ AI Generated") -> io.BytesIO:
    doc = Document()

    # Set page margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Document Header Title
    title_para = doc.add_paragraph()
    title_run = title_para.add_run(title)
    title_run.font.size = Pt(22)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(109, 40, 217)  # Brand Purple
    title_para.paragraph_format.space_after = Pt(4)

    # Subtitle with date
    sub_para = doc.add_paragraph()
    date_str = datetime.now().strftime("%B %d, %Y - %I:%M %p")
    sub_run = sub_para.add_run(f"{subtitle}  •  {date_str}")
    sub_run.font.size = Pt(9.5)
    sub_run.font.color.rgb = RGBColor(100, 116, 139)  # Slate Gray
    sub_para.paragraph_format.space_after = Pt(18)

    # Parse content lines and format
    lines = content.split("\n")
    in_code_block = False

    for line in lines:
        stripped = line.strip()

        if not stripped:
            continue

        # Code block toggle
        if stripped.startswith("```"):
            in_code_block = not in_code_block
            continue

        if in_code_block:
            p = doc.add_paragraph()
            r = p.add_run(line)
            r.font.name = "Consolas"
            r.font.size = Pt(9)
            p.paragraph_format.left_indent = Inches(0.4)
            p.paragraph_format.space_after = Pt(2)
            continue

        # Headings
        if stripped.startswith("### "):
            p = doc.add_paragraph()
            r = p.add_run(stripped[4:])
            r.font.size = Pt(13)
            r.font.bold = True
            r.font.color.rgb = RGBColor(124, 58, 237)
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(4)

        elif stripped.startswith("## "):
            p = doc.add_paragraph()
            r = p.add_run(stripped[3:])
            r.font.size = Pt(15)
            r.font.bold = True
            r.font.color.rgb = RGBColor(76, 29, 149)
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(6)

        elif stripped.startswith("# "):
            p = doc.add_paragraph()
            r = p.add_run(stripped[2:])
            r.font.size = Pt(17)
            r.font.bold = True
            r.font.color.rgb = RGBColor(91, 33, 182)
            p.paragraph_format.space_before = Pt(16)
            p.paragraph_format.space_after = Pt(6)

        # Horizontal rule
        elif stripped in ["---", "***", "___"]:
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(8)
            r = p.add_run("____________________________________________________________")
            r.font.color.rgb = RGBColor(226, 232, 240)

        # Bullet items
        elif stripped.startswith("- ") or stripped.startswith("* "):
            p = doc.add_paragraph(style="List Bullet")
            _add_styled_runs(p, stripped[2:])
            p.paragraph_format.space_after = Pt(3)

        # Numbered items
        elif re.match(r"^\d+\.\s+", stripped):
            match = re.match(r"^(\d+\.\s+)(.*)", stripped)
            p = doc.add_paragraph(style="List Number")
            _add_styled_runs(p, match.group(2))
            p.paragraph_format.space_after = Pt(3)

        # Standard paragraph
        else:
            p = doc.add_paragraph()
            _add_styled_runs(p, stripped)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.line_spacing = 1.15

    file_stream = io.BytesIO()
    doc.save(file_stream)
    file_stream.seek(0)
    return file_stream


def _add_styled_runs(paragraph, text: str):
    """
    Parses simple markdown bold (**text**) and italic (*text*) inside a line.
    """
    # Split by bold markers
    parts = re.split(r"(\*\*.*?\*\*)", text)
    for part in parts:
        if part.startswith("**") and part.endswith("**") and len(part) >= 4:
            r = paragraph.add_run(part[2:-2])
            r.bold = True
        else:
            # Check for inline code `...`
            code_parts = re.split(r"(`.*?`)", part)
            for cp in code_parts:
                if cp.startswith("`") and cp.endswith("`") and len(cp) >= 2:
                    r = paragraph.add_run(cp[1:-1])
                    r.font.name = "Consolas"
                    r.font.size = Pt(9.5)
                    r.font.color.rgb = RGBColor(124, 58, 237)
                else:
                    paragraph.add_run(cp)
