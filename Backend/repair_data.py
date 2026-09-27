"""
One-off migration script to clean and repair scrambled PDF notes currently in the database.
"""

import os
import sys
import re
import unicodedata
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import vector_store
from chunking import chunk_text
from ingestion import clean_text

DB_PATH = os.path.join(BASE_DIR, "data", "app.db")


def repair_notes_text(text: str) -> str:
    # 1. Normalize Unicode & Ligatures
    text = unicodedata.normalize("NFKD", text)

    # 2. Standardize bullet symbols
    for b in ["●", "■", "◆", "○", "►", "•"]:
        text = text.replace(b, "\n- ")
    text = text.replace("–", " - ").replace("—", " -- ")

    # 3. Process page segments
    pages = text.split("--- [Page")
    cleaned_pages = []

    header_pattern = re.compile(
        r"CYBER\s+SECURITY:\s+FROM\s+BEGINNER\s+TO\s+EXPERT", re.IGNORECASE
    )

    for p in pages:
        if not p.strip():
            continue

        lines = p.split("\n")
        # Match page number from header, e.g. " 7] ---"
        first_line = lines[0] if lines else ""
        m = re.search(r"(\d+)", first_line)
        page_num = m.group(1) if m else "?"

        page_body = "\n".join(lines[1:]) if len(lines) > 1 else ""

        # Remove repetitive header/watermark
        page_body = header_pattern.sub("", page_body)
        page_body = re.sub(r"(Join\s+Today\s*)+", "", page_body, flags=re.IGNORECASE)

        # Merge word-per-line artifacts
        raw_lines = [l.strip() for l in page_body.split("\n") if l.strip()]
        paragraphs = []
        curr = []

        for line in raw_lines:
            if not curr:
                curr.append(line)
            else:
                prev = curr[-1]
                # Break paragraph on bullets, headings, or sentence terminators
                if line.startswith("- ") or line.startswith("#"):
                    paragraphs.append(" ".join(curr))
                    curr = [line]
                elif prev.endswith(":") or prev.endswith((".", "!", "?", "---")):
                    paragraphs.append(" ".join(curr))
                    curr = [line]
                else:
                    curr.append(line)

        if curr:
            paragraphs.append(" ".join(curr))

        body = "\n\n".join(paragraphs)
        body = re.sub(r" +", " ", body).strip()
        if body:
            cleaned_pages.append(f"## Page {page_num}\n\n{body}")

    return "\n\n---\n\n".join(cleaned_pages)


def run():
    if not os.path.exists(DB_PATH):
        print("No database found at:", DB_PATH)
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, filename, content FROM documents")
    docs = cursor.fetchall()
    print(f"Repairing {len(docs)} document(s)...")

    for doc_id, filename, content in docs:
        cleaned = repair_notes_text(content)
        cleaned = clean_text(cleaned)
        chunks = chunk_text(cleaned)
        chars = len(cleaned)
        words = len(cleaned.split())
        preview = cleaned[:400] + "..."

        cursor.execute(
            """
            UPDATE documents 
            SET content = ?, char_count = ?, word_count = ?, chunk_count = ?, preview = ?
            WHERE id = ?
            """,
            (cleaned, chars, words, len(chunks), preview, doc_id),
        )
        conn.commit()

        # Update ChromaDB vector chunks
        try:
            vector_store.delete_chunks(doc_id)
            vector_store.add_chunks(doc_id, chunks)
            print(f"Successfully repaired '{filename}': {words} words, {len(chunks)} chunks.")
        except Exception as e:
            print(f"Vector update warning for '{filename}': {e}")

    conn.close()
    print("Repair complete!")


if __name__ == "__main__":
    run()
