"""
Handles turning uploaded files (PDF, DOCX, TXT, MD, CSV, JSON) into clean plain text.
Uses PyMuPDF (fitz) for high-fidelity PDF extraction and layout parsing,
with graceful fallback to pypdf.
"""

import io
import re
import csv
import json
import unicodedata
from typing import Tuple
from docx import Document


def clean_text(text: str) -> str:
    """
    Normalizes unicode ligatures, standardizes bullets,
    removes excessive carriage returns, and collapses blank lines.
    """
    if not text:
        return ""

    # Normalize unicode ligatures (fi, fl, ffi, etc.)
    text = unicodedata.normalize("NFKD", text)

    # Standardize bullet symbols to markdown dashes
    for bullet in ["●", "■", "◆", "○", "►", "•"]:
        text = text.replace(bullet, "\n- ")

    # Standardize quotation marks and dashes
    text = text.replace("–", " - ").replace("—", " -- ")
    text = text.replace("“", '"').replace("”", '"')
    text = text.replace("‘", "'").replace("’", "'")

    # Normalize newlines
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Collapse 3 or more newlines into 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def extract_text_and_meta(filename: str, file_bytes: bytes) -> Tuple[str, int]:
    """
    Detects file type from its extension, extracts plain text, and returns (text, page_count).
    Raises ValueError for unsupported or unreadable files.
    """
    lower_name = filename.lower()

    if lower_name.endswith(".pdf"):
        return _extract_from_pdf(file_bytes)
    elif lower_name.endswith(".docx"):
        return _extract_from_docx(file_bytes)
    elif lower_name.endswith((".txt", ".md", ".markdown")):
        text = file_bytes.decode("utf-8", errors="replace")
        return clean_text(text), 1
    elif lower_name.endswith(".csv"):
        return _extract_from_csv(file_bytes)
    elif lower_name.endswith(".json"):
        return _extract_from_json(file_bytes)
    else:
        raise ValueError(
            f"Unsupported file type '{filename}'. Supported formats: PDF, DOCX, TXT, MD, CSV, JSON."
        )


def extract_text(filename: str, file_bytes: bytes) -> str:
    """Backward compatible wrapper returning only text."""
    text, _ = extract_text_and_meta(filename, file_bytes)
    return text


def _extract_from_pdf(file_bytes: bytes) -> Tuple[str, int]:
    """
    Extracts text from PDF using PyMuPDF (fitz) with clean block layout.
    Falls back to pypdf if pymupdf is not available.
    """
    # 1. Try PyMuPDF (fitz)
    try:
        import pymupdf

        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
        num_pages = len(doc)
        pages_text = []

        for i, page in enumerate(doc):
            # Extract text blocks in reading order
            blocks = page.get_text("blocks")
            # Filter text blocks (block[6] == 0 is text)
            block_strings = []
            for b in blocks:
                if len(b) >= 5 and b[4]:
                    block_txt = b[4].strip()
                    if block_txt:
                        block_strings.append(block_txt)

            if block_strings:
                page_body = "\n\n".join(block_strings)
            else:
                page_body = page.get_text("text").strip()

            if page_body:
                cleaned_body = clean_text(page_body)
                pages_text.append(f"## Page {i + 1}\n\n{cleaned_body}")

        full_text = "\n\n---\n\n".join(pages_text)
        return full_text.strip(), max(1, num_pages)

    except Exception:
        # 2. Fallback to pypdf
        return _extract_from_pdf_pypdf(file_bytes)


def _extract_from_pdf_pypdf(file_bytes: bytes) -> Tuple[str, int]:
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(file_bytes))
        num_pages = len(reader.pages)
        pages_text = []

        for i, page in enumerate(reader.pages):
            txt = page.extract_text() or ""
            if txt.strip():
                # Fix word-per-line artifacts produced by pypdf
                lines = [l.strip() for l in txt.split("\n") if l.strip()]
                paras = []
                curr = []
                for line in lines:
                    if not curr:
                        curr.append(line)
                    else:
                        prev = curr[-1]
                        if line.startswith("- ") or line.startswith("#") or prev.endswith((".", "!", "?", ":")):
                            paras.append(" ".join(curr))
                            curr = [line]
                        else:
                            curr.append(line)
                if curr:
                    paras.append(" ".join(curr))
                page_content = clean_text("\n\n".join(paras))
                pages_text.append(f"## Page {i + 1}\n\n{page_content}")

        full_text = "\n\n---\n\n".join(pages_text)
        return full_text.strip(), max(1, num_pages)
    except Exception as e:
        raise ValueError(f"Failed to read PDF file: {str(e)}")


def _extract_from_docx(file_bytes: bytes) -> Tuple[str, int]:
    try:
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        
        table_text = []
        for table in doc.tables:
            for row in table.rows:
                row_str = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_str:
                    table_text.append(row_str)

        combined = "\n\n".join(paragraphs + table_text)
        return clean_text(combined), 1
    except Exception as e:
        raise ValueError(f"Failed to read DOCX file: {str(e)}")


def _extract_from_csv(file_bytes: bytes) -> Tuple[str, int]:
    try:
        content = file_bytes.decode("utf-8", errors="replace")
        reader = csv.reader(io.StringIO(content))
        lines = []
        for row in reader:
            if any(row):
                lines.append(" | ".join(row))
        return clean_text("\n".join(lines)), 1
    except Exception as e:
        raise ValueError(f"Failed to parse CSV file: {str(e)}")


def _extract_from_json(file_bytes: bytes) -> Tuple[str, int]:
    try:
        content = file_bytes.decode("utf-8", errors="replace")
        data = json.loads(content)
        formatted = json.dumps(data, indent=2)
        return clean_text(formatted), 1
    except Exception as e:
        raise ValueError(f"Failed to parse JSON file: {str(e)}")
