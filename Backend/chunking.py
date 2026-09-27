"""
Splits long text into smaller overlapping chunks with paragraph & sentence boundary awareness,
so each chunk fits comfortably in an embedding model and stays contextually coherent.
"""

from typing import List


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    """
    Splits text into chunks of approximately `chunk_size` characters,
    prioritizing natural paragraph and sentence boundaries, with `overlap`
    characters retained to maintain continuity across boundaries.
    """
    text = text.strip()
    if not text:
        return []

    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    text_length = len(text)

    while start < text_length:
        end = start + chunk_size

        if end >= text_length:
            chunks.append(text[start:].strip())
            break

        # Try to find a natural boundary: paragraph break, line break, or sentence end
        boundary = -1
        # Check within the last 150 chars of the prospective chunk
        search_window = text[max(start, end - 150):end]
        
        # Priority 1: Double newline (paragraph break)
        pos = search_window.rfind("\n\n")
        if pos != -1:
            boundary = max(start, end - 150) + pos + 2
        else:
            # Priority 2: Single newline
            pos = search_window.rfind("\n")
            if pos != -1:
                boundary = max(start, end - 150) + pos + 1
            else:
                # Priority 3: Sentence ending punctuation (. ! ?)
                for punct in [". ", "? ", "! "]:
                    pos = search_window.rfind(punct)
                    if pos != -1:
                        boundary = max(start, end - 150) + pos + 2
                        break

        # Priority 4: Space boundary
        if boundary == -1:
            pos = search_window.rfind(" ")
            if pos != -1:
                boundary = max(start, end - 150) + pos + 1
            else:
                boundary = end

        chunk = text[start:boundary].strip()
        if chunk:
            chunks.append(chunk)

        # Advance start position with overlap
        start = max(start + 1, boundary - overlap)

    return chunks
