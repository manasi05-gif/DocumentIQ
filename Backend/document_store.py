"""
Persistent document and chat history store using Python's built-in sqlite3.
Ensures uploaded documents, summaries, and chats survive server restarts.
"""

import os
import json
import sqlite3
import uuid
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "app.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                file_type TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                char_count INTEGER NOT NULL,
                word_count INTEGER NOT NULL,
                chunk_count INTEGER NOT NULL,
                page_count INTEGER DEFAULT 1,
                preview TEXT NOT NULL,
                content TEXT NOT NULL,
                summary TEXT,
                summary_type TEXT,
                created_at TEXT NOT NULL,
                user_id TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                doc_id TEXT NOT NULL,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (doc_id) REFERENCES documents (id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id TEXT NOT NULL,
                session_id TEXT,
                role TEXT NOT NULL,
                message TEXT NOT NULL,
                sources TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (doc_id) REFERENCES documents (id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS topic_mastery (
                id TEXT PRIMARY KEY,
                doc_id TEXT NOT NULL,
                topic TEXT NOT NULL,
                questions_attempted INTEGER DEFAULT 0,
                questions_correct INTEGER DEFAULT 0,
                accuracy REAL DEFAULT 0.0,
                level TEXT DEFAULT 'beginner',
                status TEXT DEFAULT 'weak',
                last_improvement_tip TEXT,
                updated_at TEXT NOT NULL,
                UNIQUE(doc_id, topic),
                FOREIGN KEY (doc_id) REFERENCES documents (id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS document_topics (
                doc_id TEXT PRIMARY KEY,
                topics_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (doc_id) REFERENCES documents (id) ON DELETE CASCADE
            )
        """)

        # Migration: Ensure session_id column exists in chat_history
        cursor = conn.execute("PRAGMA table_info(chat_history)")
        columns = [row["name"] for row in cursor.fetchall()]
        if "session_id" not in columns:
            conn.execute("ALTER TABLE chat_history ADD COLUMN session_id TEXT")

        # Migration: Ensure user_id column exists in documents
        cursor = conn.execute("PRAGMA table_info(documents)")
        columns = [row["name"] for row in cursor.fetchall()]
        if "user_id" not in columns:
            conn.execute("ALTER TABLE documents ADD COLUMN user_id TEXT")

        # Backfill orphan chat messages into a default session per document
        cursor = conn.execute(
            "SELECT DISTINCT doc_id FROM chat_history WHERE session_id IS NULL OR session_id = ''"
        )
        orphan_docs = [row["doc_id"] for row in cursor.fetchall()]
        for doc_id in orphan_docs:
            first_msg_cur = conn.execute(
                "SELECT message, created_at FROM chat_history WHERE doc_id = ? AND role = 'user' ORDER BY id ASC LIMIT 1",
                (doc_id,),
            )
            first_msg = first_msg_cur.fetchone()
            if first_msg and first_msg["message"]:
                title = first_msg["message"][:38].strip()
                if len(first_msg["message"]) > 38:
                    title += "..."
                created_time = first_msg["created_at"]
            else:
                title = "Initial Chat"
                created_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            sess_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO chat_sessions (id, doc_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (sess_id, doc_id, title, created_time, created_time),
            )
            conn.execute(
                "UPDATE chat_history SET session_id = ? WHERE doc_id = ? AND (session_id IS NULL OR session_id = '')",
                (sess_id, doc_id),
            )

        conn.commit()


# Initialize on module load
init_db()


# ==========================================
# Authentication & User Management
# ==========================================
def hash_password(password: str) -> str:
    """Hashes a password with PBKDF2-HMAC-SHA256 and a random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}${key.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    """Verifies a plain password against the stored salt$hash."""
    try:
        parts = hashed.split("$")
        if len(parts) != 2:
            return False
        salt, key_hex = parts
        test_key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return secrets.compare_digest(test_key.hex(), key_hex)
    except Exception:
        return False


def create_user(name: str, email: str, password: str) -> Dict[str, Any]:
    """Registers a new user."""
    email_clean = email.strip().lower()
    name_clean = name.strip()
    if not name_clean:
        raise ValueError("Name is required")
    if not email_clean or "@" not in email_clean:
        raise ValueError("A valid email address is required")
    if not password or len(password) < 6:
        raise ValueError("Password must be at least 6 characters")

    user_id = str(uuid.uuid4())
    pw_hash = hash_password(password)
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with get_connection() as conn:
        cur = conn.execute("SELECT id FROM users WHERE email = ?", (email_clean,))
        if cur.fetchone():
            raise ValueError("An account with this email already exists")

        conn.execute(
            "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, name_clean, email_clean, pw_hash, created_at),
        )
        conn.commit()

    return {"id": user_id, "name": name_clean, "email": email_clean, "created_at": created_at}


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticates email & password, returning user info without password."""
    email_clean = email.strip().lower()
    with get_connection() as conn:
        cur = conn.execute(
            "SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?",
            (email_clean,),
        )
        row = cur.fetchone()
        if not row:
            return None
        if not verify_password(password, row["password_hash"]):
            return None
        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "created_at": row["created_at"],
        }


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Retrieves full user record by email."""
    if not email:
        return None
    email_clean = email.strip().lower()
    with get_connection() as conn:
        cur = conn.execute(
            "SELECT id, name, email, password_hash, created_at FROM users WHERE email = ?",
            (email_clean,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def create_session(user_id: str, days: int = 30) -> str:
    """Creates a persistent login session token."""
    token = secrets.token_urlsafe(32)
    now = datetime.now()
    created_at = now.strftime("%Y-%m-%d %H:%M:%S")
    expires_at = (now + timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")

    with get_connection() as conn:
        conn.execute(
            "INSERT INTO user_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, user_id, created_at, expires_at),
        )
        conn.commit()
    return token


def get_user_by_session(token: str) -> Optional[Dict[str, Any]]:
    """Retrieves user info for an active session token."""
    if not token:
        return None
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_connection() as conn:
        cur = conn.execute(
            """
            SELECT u.id, u.name, u.email, u.created_at
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > ?
            """,
            (token, now_str),
        )
        row = cur.fetchone()
        if row:
            return dict(row)
        return None


def delete_session(token: str) -> bool:
    """Logs out by invalidating session token."""
    if not token:
        return False
    with get_connection() as conn:
        conn.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
        conn.commit()
    return True



def save_document(
    doc_id: str,
    filename: str,
    file_type: str,
    file_size: int,
    content: str,
    chunk_count: int,
    page_count: int = 1,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    char_count = len(content)
    word_count = len(content.split())
    preview = content[:400] + ("..." if len(content) > 400 else "")
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO documents 
            (id, filename, file_type, file_size, char_count, word_count, chunk_count, page_count, preview, content, created_at, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                doc_id,
                filename,
                file_type,
                file_size,
                char_count,
                word_count,
                chunk_count,
                page_count,
                preview,
                content,
                created_at,
                user_id,
            ),
        )
        conn.commit()

    return {
        "id": doc_id,
        "filename": filename,
        "file_type": file_type,
        "file_size": file_size,
        "char_count": char_count,
        "word_count": word_count,
        "chunk_count": chunk_count,
        "page_count": page_count,
        "preview": preview,
        "created_at": created_at,
        "user_id": user_id,
    }


def list_documents(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        if user_id:
            cursor = conn.execute(
                """
                SELECT id, filename, file_type, file_size, char_count, word_count, chunk_count, page_count, preview, summary, created_at, user_id
                FROM documents
                WHERE user_id = ? OR user_id IS NULL
                ORDER BY created_at DESC
                """,
                (user_id,),
            )
        else:
            cursor = conn.execute(
                """
                SELECT id, filename, file_type, file_size, char_count, word_count, chunk_count, page_count, preview, summary, created_at, user_id
                FROM documents
                ORDER BY created_at DESC
                """
            )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_document(doc_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.execute(
            """
            SELECT * FROM documents WHERE id = ?
            """,
            (doc_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def update_summary(doc_id: str, summary: str, summary_type: str = "bullet") -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE documents SET summary = ?, summary_type = ? WHERE id = ?",
            (summary, summary_type, doc_id),
        )
        conn.commit()


def delete_document(doc_id: str, user_id: Optional[str] = None) -> bool:
    with get_connection() as conn:
        if user_id:
            cursor = conn.execute(
                "DELETE FROM documents WHERE id = ? AND (user_id = ? OR user_id IS NULL)",
                (doc_id, user_id),
            )
        else:
            cursor = conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.execute("DELETE FROM chat_sessions WHERE doc_id = ?", (doc_id,))
        conn.execute("DELETE FROM chat_history WHERE doc_id = ?", (doc_id,))
        conn.commit()
        return cursor.rowcount > 0



# ==========================================
# Chat Session Management
# ==========================================
def create_chat_session(doc_id: str, title: Optional[str] = None) -> Dict[str, Any]:
    sess_id = str(uuid.uuid4())
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    session_title = title.strip() if title and title.strip() else "New Chat"

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO chat_sessions (id, doc_id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (sess_id, doc_id, session_title, now, now),
        )
        conn.commit()

    return {
        "id": sess_id,
        "doc_id": doc_id,
        "title": session_title,
        "message_count": 0,
        "created_at": now,
        "updated_at": now,
    }


def list_chat_sessions(doc_id: str) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.execute(
            """
            SELECT s.id, s.doc_id, s.title, s.created_at, s.updated_at,
                   COUNT(h.id) AS message_count,
                   MAX(h.created_at) AS last_message_time
            FROM chat_sessions s
            LEFT JOIN chat_history h ON s.id = h.session_id
            WHERE s.doc_id = ?
            GROUP BY s.id
            ORDER BY s.updated_at DESC
            """,
            (doc_id,),
        )
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def get_chat_session(session_id: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM chat_sessions WHERE id = ?",
            (session_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def update_chat_session_title(session_id: str, title: str) -> bool:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_connection() as conn:
        cursor = conn.execute(
            "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?",
            (title.strip(), now, session_id),
        )
        conn.commit()
        return cursor.rowcount > 0


def delete_chat_session(session_id: str) -> bool:
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
        conn.execute("DELETE FROM chat_history WHERE session_id = ?", (session_id,))
        conn.commit()
        return cursor.rowcount > 0


def get_or_create_active_session(doc_id: str, requested_session_id: Optional[str] = None) -> Dict[str, Any]:
    if requested_session_id:
        sess = get_chat_session(requested_session_id)
        if sess and sess["doc_id"] == doc_id:
            return sess

    # Find the most recently updated session
    sessions = list_chat_sessions(doc_id)
    if sessions:
        return sessions[0]

    # Create a fresh new session
    return create_chat_session(doc_id, title="New Chat")


# ==========================================
# Chat Message Management
# ==========================================
def add_chat_message(
    doc_id: str,
    role: str,
    message: str,
    sources: Optional[List[Dict[str, Any]]] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    sources_json = json.dumps(sources) if sources else None

    # Ensure a valid session exists
    session = get_or_create_active_session(doc_id, session_id)
    active_session_id = session["id"]

    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO chat_history (doc_id, session_id, role, message, sources, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (doc_id, active_session_id, role, message, sources_json, created_at),
        )

        # Update session's updated_at
        conn.execute(
            "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
            (created_at, active_session_id),
        )

        # Auto-title session if it's the first user message and title is still "New Chat"
        current_title = session.get("title", "")
        if role == "user" and (current_title in ("New Chat", "Initial Chat", "") or not current_title):
            auto_title = message[:38].strip()
            if len(message) > 38:
                auto_title += "..."
            conn.execute(
                "UPDATE chat_sessions SET title = ? WHERE id = ?",
                (auto_title, active_session_id),
            )
            session["title"] = auto_title

        conn.commit()
        msg_id = cursor.lastrowid

    return {
        "id": msg_id,
        "doc_id": doc_id,
        "session_id": active_session_id,
        "role": role,
        "message": message,
        "sources": sources or [],
        "created_at": created_at,
        "session_title": session.get("title", "New Chat"),
    }


def get_chat_history(doc_id: str, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        if session_id:
            cursor = conn.execute(
                """
                SELECT id, doc_id, session_id, role, message, sources, created_at
                FROM chat_history
                WHERE doc_id = ? AND session_id = ?
                ORDER BY id ASC
                """,
                (doc_id, session_id),
            )
        else:
            # Default to most recent session
            active_session = get_or_create_active_session(doc_id)
            cursor = conn.execute(
                """
                SELECT id, doc_id, session_id, role, message, sources, created_at
                FROM chat_history
                WHERE doc_id = ? AND session_id = ?
                ORDER BY id ASC
                """,
                (doc_id, active_session["id"]),
            )

        rows = cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            if d.get("sources"):
                try:
                    d["sources"] = json.loads(d["sources"])
                except Exception:
                    d["sources"] = []
            else:
                d["sources"] = []
            result.append(d)
        return result


def clear_chat_history(doc_id: str, session_id: Optional[str] = None) -> None:
    with get_connection() as conn:
        if session_id:
            conn.execute("DELETE FROM chat_history WHERE session_id = ?", (session_id,))
            conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
        else:
            conn.execute("DELETE FROM chat_history WHERE doc_id = ?", (doc_id,))
            conn.execute("DELETE FROM chat_sessions WHERE doc_id = ?", (doc_id,))
        conn.commit()


# ==========================================
# Topic Mastery & Knowledge Radar Methods
# ==========================================
def record_topic_result(
    doc_id: str,
    topic: str,
    is_correct: bool,
    improvement_tip: Optional[str] = None,
    current_level: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Records the outcome of a question for a specific topic in a document.
    Updates questions_attempted, questions_correct, accuracy %, mastery status, and level.
    """
    clean_topic = topic.strip() if topic else "Core Concepts"
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with get_connection() as conn:
        cursor = conn.execute(
            "SELECT * FROM topic_mastery WHERE doc_id = ? AND topic = ?",
            (doc_id, clean_topic),
        )
        row = cursor.fetchone()

        if row:
            attempted = row["questions_attempted"] + 1
            correct = row["questions_correct"] + (1 if is_correct else 0)
            accuracy = round((correct / attempted) * 100.0, 1)

            # Determine level
            level = current_level or row["level"] or "beginner"
            if current_level:
                level = current_level

            # Mastery Status calculation
            if attempted >= 3 and accuracy >= 80.0:
                if level == "advanced" or accuracy >= 90.0:
                    status = "mastered"
                    level = "mastered"
                else:
                    status = "proficient"
            elif accuracy >= 60.0:
                status = "learning"
            else:
                status = "weak"

            tip = improvement_tip if improvement_tip else row["last_improvement_tip"]

            conn.execute(
                """
                UPDATE topic_mastery
                SET questions_attempted = ?, questions_correct = ?, accuracy = ?, level = ?, status = ?, last_improvement_tip = ?, updated_at = ?
                WHERE id = ?
                """,
                (attempted, correct, accuracy, level, status, tip, now, row["id"]),
            )
            item_id = row["id"]
        else:
            item_id = str(uuid.uuid4())
            attempted = 1
            correct = 1 if is_correct else 0
            accuracy = 100.0 if is_correct else 0.0
            level = current_level or "beginner"
            status = "learning" if is_correct else "weak"
            tip = improvement_tip or ""

            conn.execute(
                """
                INSERT INTO topic_mastery
                (id, doc_id, topic, questions_attempted, questions_correct, accuracy, level, status, last_improvement_tip, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (item_id, doc_id, clean_topic, attempted, correct, accuracy, level, status, tip, now),
            )

        conn.commit()

        cur = conn.execute("SELECT * FROM topic_mastery WHERE id = ?", (item_id,))
        return dict(cur.fetchone())


def get_topic_mastery(doc_id: str) -> Dict[str, Any]:
    """
    Returns the student's mastery profile for a document:
    - weak_topics: accuracy < 60%
    - learning_topics: accuracy 60% - 79%
    - proficient_topics: accuracy 80% - 89%
    - mastered_topics: accuracy >= 90% or completed advanced ladder
    """
    with get_connection() as conn:
        cursor = conn.execute(
            """
            SELECT * FROM topic_mastery
            WHERE doc_id = ?
            ORDER BY 
                CASE status
                    WHEN 'weak' THEN 1
                    WHEN 'learning' THEN 2
                    WHEN 'proficient' THEN 3
                    WHEN 'mastered' THEN 4
                    ELSE 5
                END ASC, accuracy ASC, updated_at DESC
            """,
            (doc_id,),
        )
        rows = [dict(r) for r in cursor.fetchall()]

    weak = [r for r in rows if r["status"] == "weak"]
    learning = [r for r in rows if r["status"] == "learning"]
    proficient = [r for r in rows if r["status"] == "proficient"]
    mastered = [r for r in rows if r["status"] == "mastered"]

    total_attempted = sum(r["questions_attempted"] for r in rows)
    total_correct = sum(r["questions_correct"] for r in rows)
    overall_accuracy = round((total_correct / max(1, total_attempted)) * 100.0, 1) if total_attempted > 0 else 0.0

    return {
        "doc_id": doc_id,
        "total_topics_tracked": len(rows),
        "total_questions_attempted": total_attempted,
        "total_questions_correct": total_correct,
        "overall_accuracy": overall_accuracy,
        "weak_topics": weak,
        "learning_topics": learning,
        "proficient_topics": proficient,
        "mastered_topics": mastered,
        "all_topics": rows,
    }


def save_document_topics(doc_id: str, topics: List[str]) -> None:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    topics_json = json.dumps(topics)
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO document_topics (doc_id, topics_json, updated_at)
            VALUES (?, ?, ?)
            """,
            (doc_id, topics_json, now),
        )
        conn.commit()


def get_document_topics(doc_id: str) -> Optional[List[str]]:
    with get_connection() as conn:
        cur = conn.execute("SELECT topics_json FROM document_topics WHERE doc_id = ?", (doc_id,))
        row = cur.fetchone()
        if row and row["topics_json"]:
            try:
                return json.loads(row["topics_json"])
            except Exception:
                return None
    return None


def reset_topic_mastery(doc_id: str, topic: Optional[str] = None) -> None:
    with get_connection() as conn:
        if topic:
            conn.execute("DELETE FROM topic_mastery WHERE doc_id = ? AND topic = ?", (doc_id, topic))
        else:
            conn.execute("DELETE FROM topic_mastery WHERE doc_id = ?", (doc_id,))
        conn.commit()

