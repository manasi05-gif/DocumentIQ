import os
import sys
import uuid
import re
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel

# Ensure Backend directory is first on sys.path for local module imports
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from gemini_client import (
    summarize_text,
    answer_question,
    generate_quiz,
    generate_flashcards,
    generate_mindmap,
    generate_cheatsheet,
    extract_document_topics,
    generate_targeted_drill,
    CANDIDATE_MODELS,
)
from ingestion import extract_text_and_meta
from chunking import chunk_text
from vector_store import add_chunks, query_chunks, query_chunks_with_metadata, delete_chunks
from exporter import create_docx
import document_store

app = FastAPI(
    title="DocumentIQ - Smart Document Q&A & Analyzer",
    description="RAG-powered intelligent document analysis, question answering, multi-style summarization, study suites, and mind mapping.",
    version="3.0.0",
)

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "Frontend")
os.makedirs(FRONTEND_DIR, exist_ok=True)

# Mount static frontend files if directory exists
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


@app.get("/")
def serve_index():
    """Serves the web application user interface."""
    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(
            index_file,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    return {
        "status": "ok",
        "message": "DocumentIQ API is running. Place index.html in Frontend/ to view the UI.",
    }


@app.get("/api/health")
@app.get("/health")
def health_check(request: Request):
    """Confirms the server, vector store, and Gemini configuration status."""
    has_api_key = bool(os.environ.get("GEMINI_API_KEY"))
    user = get_user_from_request(request)
    docs_count = len(document_store.list_documents(user_id=user["id"] if user else None))
    return {
        "status": "ok",
        "gemini_configured": has_api_key,
        "active_models": CANDIDATE_MODELS,
        "total_documents": docs_count,
    }


# ==========================================
# User Authentication Endpoints
# ==========================================
def get_user_from_request(request: Request) -> Optional[dict]:
    """Extracts bearer token and resolves the authenticated user."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:].strip()
    return document_store.get_user_by_session(token)


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


@app.post("/api/auth/register")
def register_user(req: RegisterRequest):
    """Creates a new user account and returns a login session token."""
    try:
        user = document_store.create_user(req.name, req.email, req.password)
        document_store.claim_unassigned_documents(user["id"])
        token = document_store.create_session(user["id"])
        return {
            "status": "ok",
            "token": token,
            "user": user,
            "message": "Account created successfully.",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to create account.")


@app.post("/api/auth/login")
def login_user(req: LoginRequest):
    """Verifies credentials and returns a session token. Supports auto-restoration across ephemeral restarts."""
    email_clean = req.email.strip().lower()
    existing_user = document_store.get_user_by_email(email_clean)

    if existing_user:
        # User exists in database: verify password strictly
        if not document_store.verify_password(req.password, existing_user["password_hash"]):
            raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")
        user = {
            "id": existing_user["id"],
            "name": existing_user["name"],
            "email": existing_user["email"],
            "created_at": existing_user["created_at"],
        }
    else:
        # User does not exist in SQLite (e.g. server was redeployed or restarted on free-tier ephemeral disk).
        # Seamlessly auto-restore their account so user NEVER has to re-register!
        default_name = req.name.strip() if req.name and req.name.strip() else email_clean.split("@")[0].capitalize()
        user = document_store.create_user(default_name, email_clean, req.password)

    document_store.claim_unassigned_documents(user["id"])
    token = document_store.create_session(user["id"])
    return {
        "status": "ok",
        "token": token,
        "user": user,
        "message": "Logged in successfully.",
    }


@app.get("/api/auth/me")
def get_authenticated_user(request: Request):
    """Validates the current session token and returns user profile."""
    user = get_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please sign in.")
    return {"status": "ok", "user": user}


@app.post("/api/auth/logout")
def logout_user(request: Request):
    """Revokes the current session token."""
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        document_store.delete_session(token)
    return {"status": "ok", "message": "Logged out successfully."}


# ==========================================
# Document Management & Upload Endpoints
# ==========================================


@app.post("/upload")
@app.post("/api/upload")
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Uploads a document (PDF, DOCX, TXT, MD, CSV, JSON),
    extracts content, generates semantic chunks, embeds them into ChromaDB,
    and stores metadata persistently.
    """
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        text, page_count = extract_text_and_meta(file.filename, file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

    if not text or not text.strip():
        raise HTTPException(
            status_code=400,
            detail="No readable text found in document. If it's a scanned PDF, please provide an OCR-readable file.",
        )

    doc_id = str(uuid.uuid4())
    chunks = chunk_text(text)

    # Identify user if authenticated
    user = get_user_from_request(request)
    user_id = user["id"] if user else None

    # Persist in SQLite first so the document is immediately available and never lost
    file_size = len(file_bytes)
    ext = os.path.splitext(file.filename)[1].lower()
    doc_info = document_store.save_document(
        doc_id=doc_id,
        filename=file.filename,
        file_type=ext,
        file_size=file_size,
        content=text,
        chunk_count=len(chunks),
        page_count=page_count,
        user_id=user_id,
    )

    # Index chunks immediately in SQLite (<10ms)
    add_chunks(doc_id, chunks)

    return {
        **doc_info,
        "content": text,
        "message": f"Successfully indexed '{file.filename}' with {len(chunks)} chunks across {page_count} pages.",
    }


@app.get("/api/documents")
def get_documents(request: Request):
    """Returns list of uploaded documents for the authenticated user."""
    user = get_user_from_request(request)
    user_id = user["id"] if user else None
    return document_store.list_documents(user_id=user_id)


@app.get("/api/documents/{doc_id}")
def get_document_details(doc_id: str):
    """Returns detailed information and full text for a specific document."""
    doc = document_store.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc


@app.delete("/api/documents/{doc_id}")
def delete_document_endpoint(doc_id: str, request: Request):
    """Deletes a document from the database and deletes its vectors from ChromaDB."""
    user = get_user_from_request(request)
    user_id = user["id"] if user else None
    doc = document_store.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    delete_chunks(doc_id)
    document_store.delete_document(doc_id, user_id=user_id)
    return {"status": "ok", "message": f"Document '{doc['filename']}' deleted successfully."}


class RestoreDocumentItem(BaseModel):
    id: str
    filename: str
    file_type: Optional[str] = ".txt"
    file_size: Optional[int] = 0
    content: str
    chunk_count: Optional[int] = 0
    page_count: Optional[int] = 1
    summary: Optional[str] = None
    summary_type: Optional[str] = "bullet"
    created_at: Optional[str] = None
    sessions: Optional[List[Dict[str, Any]]] = None
    messages: Optional[List[Dict[str, Any]]] = None


class RestoreDataRequest(BaseModel):
    documents: List[RestoreDocumentItem]


@app.post("/api/documents/restore")
def restore_documents_endpoint(req: RestoreDataRequest, request: Request):
    """
    Restores client-persisted documents and chat histories to SQLite & vector search.
    Guarantees zero data loss across Render free-tier restarts.
    """
    user = get_user_from_request(request)
    user_id = user["id"] if user else None

    restored_count = 0
    for doc in req.documents:
        existing = document_store.get_document(doc.id)
        if not existing:
            # Re-insert document
            document_store.save_document(
                doc_id=doc.id,
                filename=doc.filename,
                file_type=doc.file_type or ".txt",
                file_size=doc.file_size or len(doc.content.encode("utf-8")),
                content=doc.content,
                chunk_count=doc.chunk_count or 1,
                page_count=doc.page_count or 1,
                user_id=user_id,
            )
            # Re-index chunks in BM25
            chunks = chunk_text(doc.content)
            add_chunks(doc.id, chunks)

            if doc.summary:
                document_store.update_summary(doc.id, doc.summary, summary_type=doc.summary_type or "bullet")

            restored_count += 1
        else:
            if user_id and not existing.get("user_id"):
                with document_store.get_connection() as conn:
                    conn.execute("UPDATE documents SET user_id = ? WHERE id = ?", (user_id, doc.id))
                    conn.commit()
            if doc.content:
                existing_chunks = query_chunks(doc.id, "test", top_k=1)
                if not existing_chunks:
                    chunks = chunk_text(doc.content)
                    add_chunks(doc.id, chunks)

        # Restore sessions
        if doc.sessions:
            for s in doc.sessions:
                document_store.restore_chat_session(
                    session_id=s["id"],
                    doc_id=doc.id,
                    title=s.get("title", "New Chat"),
                    created_at=s.get("created_at"),
                    updated_at=s.get("updated_at"),
                )

        # Restore messages
        if doc.messages:
            for m in doc.messages:
                document_store.restore_chat_message(
                    msg_id=m["id"],
                    doc_id=doc.id,
                    session_id=m.get("session_id"),
                    role=m.get("role", "user"),
                    message=m.get("message", ""),
                    sources=m.get("sources"),
                    created_at=m.get("created_at"),
                )

    return {"status": "ok", "restored_documents": restored_count}


# ==========================================
# Summarization Endpoints
# ==========================================


class SummarizeRequest(BaseModel):
    doc_id: str
    summary_type: Optional[str] = "bullet"  # 'bullet', 'executive', 'action_items', 'deep'
    language: Optional[str] = "auto"  # 'auto', 'hindi', 'marathi', 'english'


@app.post("/summarize")
@app.post("/api/summarize")
def summarize(req: SummarizeRequest):
    """
    Generates an AI summary of the document using Gemini.
    Supported types: bullet, executive, action_items, deep.
    Supports Hindi, Marathi, and English localization.
    """
    doc = document_store.get_document(req.doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found. Upload a document first.")

    try:
        summary = summarize_text(
            doc["content"],
            summary_type=req.summary_type or "bullet",
            language=req.language or "auto",
        )
        document_store.update_summary(req.doc_id, summary, summary_type=req.summary_type or "bullet")
        return {
            "doc_id": req.doc_id,
            "filename": doc["filename"],
            "summary_type": req.summary_type or "bullet",
            "language": req.language or "auto",
            "summary": summary,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization error: {str(e)}")


# ==========================================
# ==========================================
# Q&A / Chat & Session Endpoints
# ==========================================


class AskRequest(BaseModel):
    doc_id: str
    question: str
    session_id: Optional[str] = None
    top_k: Optional[int] = 4
    language: Optional[str] = "auto"  # 'auto', 'hindi', 'marathi', 'english'


class CreateSessionRequest(BaseModel):
    title: Optional[str] = "New Chat"


class UpdateSessionRequest(BaseModel):
    title: str


@app.get("/api/documents/{doc_id}/sessions")
def get_sessions_endpoint(doc_id: str):
    """Retrieves all saved conversation sessions for a specific document."""
    doc = document_store.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document_store.list_chat_sessions(doc_id)


@app.post("/api/documents/{doc_id}/sessions")
def create_session_endpoint(doc_id: str, req: Optional[CreateSessionRequest] = None):
    """Creates a new conversation session for a document without losing previous chats."""
    doc = document_store.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    title = req.title if req and req.title else "New Chat"
    return document_store.create_chat_session(doc_id, title=title)


@app.patch("/api/sessions/{session_id}")
def update_session_endpoint(session_id: str, req: UpdateSessionRequest):
    """Renames an existing chat session."""
    success = document_store.update_chat_session_title(session_id, req.title)
    if not success:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return {"status": "ok", "id": session_id, "title": req.title}


@app.delete("/api/sessions/{session_id}")
def delete_session_endpoint(session_id: str):
    """Deletes a specific chat session and its conversation history."""
    document_store.delete_chat_session(session_id)
    return {"status": "ok", "message": "Chat session deleted successfully."}


@app.post("/ask")
@app.post("/api/ask")
def ask(req: AskRequest):
    """
    Answers a question about the document using semantic search (BM25)
    and context-grounded response generation (Gemini) with Hindi, Marathi, and English support.
    """
    doc = document_store.get_document(req.doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found. Upload a document first.")

    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Fetch top relevant chunks
    top_k = req.top_k or 4
    sources = query_chunks_with_metadata(req.doc_id, question, top_k=top_k)

    if not sources:
        context = doc["content"][:4000]
    else:
        context = "\n\n---\n\n".join(s["text"] for s in sources)

    # Fetch recent chat history for this specific session
    history = document_store.get_chat_history(req.doc_id, session_id=req.session_id)

    try:
        answer = answer_question(
            context=context,
            question=question,
            chat_history=history,
            language=req.language or "auto",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating answer: {str(e)}")

    # Save to chat history under session
    user_msg = document_store.add_chat_message(
        doc_id=req.doc_id,
        role="user",
        message=question,
        session_id=req.session_id,
    )
    active_session_id = user_msg["session_id"]

    msg = document_store.add_chat_message(
        doc_id=req.doc_id,
        role="assistant",
        message=answer,
        sources=sources,
        session_id=active_session_id,
    )

    return {
        "doc_id": req.doc_id,
        "session_id": active_session_id,
        "session_title": user_msg.get("session_title", "New Chat"),
        "question": question,
        "answer": answer,
        "sources": sources,
        "message_id": msg["id"],
        "created_at": msg["created_at"],
    }


@app.get("/api/documents/{doc_id}/chat")
def get_chat_endpoint(doc_id: str, session_id: Optional[str] = Query(None)):
    """Retrieves conversation history for a specific document and chat session."""
    doc = document_store.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document_store.get_chat_history(doc_id, session_id=session_id)


@app.delete("/api/documents/{doc_id}/chat")
def clear_chat_endpoint(doc_id: str, session_id: Optional[str] = Query(None)):
    """Clears conversation history for a specific document or session."""
    doc = document_store.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    document_store.clear_chat_history(doc_id, session_id=session_id)
    return {"status": "ok", "message": "Chat history cleared successfully."}


# ==========================================
# Feature 1: Quiz & Flashcards Endpoints
# ==========================================


class QuizRequest(BaseModel):
    doc_id: str
    num_questions: Optional[int] = 5
    difficulty: Optional[str] = "medium"
    topic: Optional[str] = None
    language: Optional[str] = "auto"


class TargetedDrillRequest(BaseModel):
    doc_id: str
    topic: str
    level: Optional[str] = "beginner"
    num_questions: Optional[int] = 3
    language: Optional[str] = "auto"


class RecordResultItem(BaseModel):
    topic: str
    is_correct: bool
    improvement_tip: Optional[str] = None
    level: Optional[str] = None


class RecordMasteryRequest(BaseModel):
    results: List[RecordResultItem]


@app.post("/api/quiz")
def generate_quiz_endpoint(req: QuizRequest):
    """Generates an interactive revision quiz with MCQs, topic diagnostics, and improvement tips."""
    doc = document_store.get_document(req.doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        questions = generate_quiz(
            text=doc["content"],
            num_questions=req.num_questions or 5,
            difficulty=req.difficulty or "medium",
            topic=req.topic,
            language=req.language or "auto",
        )
        return {
            "doc_id": req.doc_id,
            "filename": doc["filename"],
            "difficulty": req.difficulty or "medium",
            "topic": req.topic or "All Topics",
            "total_questions": len(questions),
            "questions": questions,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quiz generation error: {str(e)}")


@app.get("/api/documents/{doc_id}/topics")
def get_document_topics_endpoint(doc_id: str):
    """Returns the list of core topics for this document, extracted with Gemini or cached in SQLite."""
    doc = document_store.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    cached = document_store.get_document_topics(doc_id)
    if cached:
        return {"doc_id": doc_id, "topics": cached}

    try:
        topics = extract_document_topics(doc["content"])
        document_store.save_document_topics(doc_id, topics)
        return {"doc_id": doc_id, "topics": topics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract topics: {str(e)}")


@app.get("/api/documents/{doc_id}/mastery")
def get_document_mastery_endpoint(doc_id: str):
    """Returns the student's mastery profile, weak topics, and practice statistics."""
    doc = document_store.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document_store.get_topic_mastery(doc_id)


@app.post("/api/documents/{doc_id}/mastery/record")
def record_mastery_endpoint(doc_id: str, req: RecordMasteryRequest):
    """Records question results to diagnose weak topics and track mastery levels."""
    doc = document_store.get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    updated_topics = []
    for item in req.results:
        rec = document_store.record_topic_result(
            doc_id=doc_id,
            topic=item.topic,
            is_correct=item.is_correct,
            improvement_tip=item.improvement_tip,
            current_level=item.level,
        )
        updated_topics.append(rec)

    mastery_profile = document_store.get_topic_mastery(doc_id)
    return {
        "status": "ok",
        "updated_records": updated_topics,
        "mastery_profile": mastery_profile,
    }


@app.post("/api/quiz/targeted-drill")
def generate_targeted_drill_endpoint(req: TargetedDrillRequest):
    """Generates an adaptive targeted practice drill for a weak topic with progressive difficulty."""
    doc = document_store.get_document(req.doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        questions = generate_targeted_drill(
            text=doc["content"],
            topic=req.topic,
            level=req.level or "beginner",
            num_questions=req.num_questions or 3,
            language=req.language or "auto",
        )
        return {
            "doc_id": req.doc_id,
            "filename": doc["filename"],
            "topic": req.topic,
            "level": req.level or "beginner",
            "total_questions": len(questions),
            "questions": questions,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Targeted drill error: {str(e)}")


class FlashcardsRequest(BaseModel):
    doc_id: str
    count: Optional[int] = 8
    language: Optional[str] = "auto"


@app.post("/api/flashcards")
def generate_flashcards_endpoint(req: FlashcardsRequest):
    """Generates revision flashcards (front: concept/term, back: definition)."""
    doc = document_store.get_document(req.doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        cards = generate_flashcards(
            text=doc["content"],
            count=req.count or 8,
            language=req.language or "auto",
        )
        return {
            "doc_id": req.doc_id,
            "filename": doc["filename"],
            "total_cards": len(cards),
            "flashcards": cards,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flashcards generation error: {str(e)}")


# ==========================================
# Feature 2: Visual Mind Map Endpoint
# ==========================================


class MindmapRequest(BaseModel):
    doc_id: str
    language: Optional[str] = "auto"


@app.post("/api/mindmap")
def generate_mindmap_endpoint(req: MindmapRequest):
    """Generates Mermaid.js diagram syntax for concept visualization."""
    doc = document_store.get_document(req.doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        mermaid_code = generate_mindmap(
            text=doc["content"],
            language=req.language or "auto",
        )
        return {
            "doc_id": req.doc_id,
            "filename": doc["filename"],
            "mermaid": mermaid_code,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mind map generation error: {str(e)}")


# ==========================================
# Feature: Cheat Sheet Generator Endpoint
# ==========================================


class CheatsheetRequest(BaseModel):
    doc_id: str
    focus: Optional[str] = "comprehensive"  # 'comprehensive', 'commands', 'formulas_definitions', 'exam_cram'
    language: Optional[str] = "auto"


@app.post("/api/cheatsheet")
def generate_cheatsheet_endpoint(req: CheatsheetRequest):
    """Extracts a high-density, multi-section Cheat Sheet from the active document."""
    doc = document_store.get_document(req.doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    try:
        data = generate_cheatsheet(
            text=doc["content"],
            focus=req.focus or "comprehensive",
            language=req.language or "auto",
        )
        return {
            "doc_id": req.doc_id,
            "filename": doc["filename"],
            "focus": req.focus or "comprehensive",
            "cheatsheet": data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cheat sheet generation error: {str(e)}")


# ==========================================
# Feature 4: DOCX Export Endpoint
# ==========================================


class ExportDocxRequest(BaseModel):
    doc_id: str
    content_type: Optional[str] = "summary"  # 'summary', 'notes'
    custom_text: Optional[str] = None
    title: Optional[str] = None


@app.post("/api/export/docx")
def export_docx_endpoint(req: ExportDocxRequest):
    """Exports document summary or notes as a styled Microsoft Word (.docx) file."""
    doc = document_store.get_document(req.doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    base_name = os.path.splitext(doc["filename"])[0]

    if req.content_type == "notes":
        content = req.custom_text or doc["content"]
        title = req.title or f"{base_name} - Document Notes"
        out_filename = f"{base_name}_Notes.docx"
    else:
        content = req.custom_text or doc.get("summary") or doc["content"][:3000]
        title = req.title or f"{base_name} - AI Summary"
        out_filename = f"{base_name}_Summary.docx"

    file_stream = create_docx(
        title=title,
        content=content,
        subtitle=f"Source: {doc['filename']}",
    )

    safe_filename = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', out_filename)

    return Response(
        content=file_stream.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
    )
