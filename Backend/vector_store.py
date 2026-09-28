"""
Wraps ChromaDB: stores chunk embeddings per document and retrieves
the most relevant chunks for a given query.
"""

import os
import chromadb
from chromadb.utils import embedding_functions

# Persists to disk in a local folder called chroma_db/
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")
client = chromadb.PersistentClient(path=CHROMA_PATH)

# Lightweight, local ONNX embedding model — no torch/sentence-transformers needed
embedding_fn = embedding_functions.DefaultEmbeddingFunction()

collection = client.get_or_create_collection(
    name="document_chunks",
    embedding_function=embedding_fn,
)


def add_chunks(doc_id: str, chunks: list[str], batch_size: int = 25) -> None:
    """Embeds and stores chunks for a document in small batches to stay within memory limits."""
    if not chunks:
        return

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        ids = [f"{doc_id}-{i + j}" for j in range(len(batch))]
        metadatas = [{"doc_id": doc_id, "chunk_index": i + j} for j in range(len(batch))]
        try:
            collection.add(ids=ids, documents=batch, metadatas=metadatas)
        except Exception as e:
            print(f"Warning: vector batch {i // batch_size} error for {doc_id}: {e}")


def query_chunks(doc_id: str, question: str, top_k: int = 4) -> list[str]:
    """Returns the top_k most relevant chunks for `question`, scoped to one document."""
    try:
        results = collection.query(
            query_texts=[question],
            n_results=top_k,
            where={"doc_id": doc_id},
        )
        return results["documents"][0] if results.get("documents") else []
    except Exception as e:
        print(f"Warning: query_chunks error for {doc_id}: {e}")
        return []


def query_chunks_with_metadata(doc_id: str, question: str, top_k: int = 4) -> list[dict]:
    """
    Returns chunks along with their index and distance for rich source citations in UI.
    """
    try:
        results = collection.query(
            query_texts=[question],
            n_results=top_k,
            where={"doc_id": doc_id},
            include=["documents", "metadatas", "distances"],
        )

        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0] if results.get("distances") else []

        sources = []
        for i, doc in enumerate(docs):
            meta = metas[i] if i < len(metas) else {}
            dist = distances[i] if i < len(distances) else None
            sources.append({
                "chunk_index": meta.get("chunk_index", i),
                "text": doc,
                "score": round(1.0 - float(dist), 3) if dist is not None else 1.0,
            })
        return sources
    except Exception as e:
        print(f"Warning: query_chunks_with_metadata error for {doc_id}: {e}")
        return []


def delete_chunks(doc_id: str) -> None:
    """Deletes all chunks associated with a specific doc_id."""
    try:
        collection.delete(where={"doc_id": doc_id})
    except Exception as e:
        print(f"Warning: error deleting chunks for {doc_id}: {e}")
