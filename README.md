# DocumentIQ — Smart Document Q&A, Study Hub & Visual Analyzer

An enterprise-ready, AI-powered intelligent document analysis application with semantic vector search, multi-format AI summarization, interactive Study Hub (Quizzes & Flashcards), Visual Mind Maps, Voice Assistant, and multi-format document exporting.

Built using **FastAPI**, **ChromaDB (Local ONNX Embeddings)**, **Google Gemini 3.8 / Flash**, and **SQLite**.

---

## ✨ Features

- 📄 **Multi-Format Ingestion**: Supports `.pdf` (high-fidelity layout extraction via PyMuPDF), `.docx`, `.txt`, `.md`, `.csv`, and `.json` documents.
- 🧩 **Semantic-Aware Chunking**: Automatically preserves sentence and paragraph boundaries for optimal vector representation.
- ⚡ **Local ONNX Vector Storage (ChromaDB)**: 100% private, free local embedding generation using `all-MiniLM-L6-v2` without requiring heavy PyTorch downloads.
- 🤖 **Resilient Gemini AI Integration**: Multi-model failover support (`gemini-flash-latest`, `gemini-3.8-flash`, `gemini-3.5-flash-lite`) with automatic exponential backoff.
- 🎯 **Multi-Style Summarization**:
  - **Key Bullet Points**: Core findings and 2-3 sentence overview.
  - **Executive Summary**: Strategic overview, risks, opportunities, and recommendations.
  - **Action Items**: Deliverables, owners, dependencies, and next steps.
  - **Deep Dive**: In-depth thematic breakdown.
- 💬 **Grounded Q&A**: Strict document context answers powered by semantic retrieval with live conversation memory.
- 🧠 **Interactive Study Hub**:
  - **Practice Quiz**: Generates multi-question multiple choice quizzes with instant feedback, score tracking, and detailed explanations.
  - **3D Flip Flashcards**: Key concept flashcards with interactive 3D card-flip animations for rapid revision and active recall.
  - **1-Click Cheat Sheet**: Ultra-dense reference sheets extracting essential commands/syntax with copy buttons, acronyms glossary, quick comparison matrices, and critical exam traps/gotchas. In-page live filtering, markdown export, and print-ready PDF styling.
- 🗺️ **Visual Mind Map & Flowchart Generator**:
  - Dynamic Mermaid.js architecture and mind map diagrams automatically rendered from document concepts.
  - Interactive pan, zoom, and live Mermaid syntax copy/view options.
- 🎙️ **Voice Input & Audio Listener**:
  - **Speech-to-Text**: Click the microphone icon to speak questions directly into the chat.
  - **Text-to-Speech**: Listen to AI responses and summaries with audio waveform visualizer and playback controls.
- 📥 **Export to PDF & DOCX**:
  - Export structured summaries, study notes, or Q&A transcripts into professionally formatted Microsoft Word (`.docx`) or print-ready PDF files.
- 💾 **Persistent SQLite Store**: All uploaded documents, stats, summaries, and chat history persist across server restarts.
- 🎨 **Modern Glassmorphic Web UI**:
  - 5 dedicated tabs: Q&A Chat, Smart Summaries, Full Document Reader, Study Hub, and Visual Mind Map.
  - Drag-and-drop file upload with animated progress.
  - Document library with file management and instant deletion.

---

## 🚀 Quick Start

### 1. One-Click Start (Windows)
Double click `start.bat` in the root folder, or run:
```powershell
.\start.bat
```

### 2. Manual Start via Python
```powershell
.\venv\Scripts\python.exe run.py
```
This automatically boots the server at `http://127.0.0.1:8000` and opens it in your default web browser.

---

## 🛠️ Project Structure

```text
Document Analyzer/
├── Backend/
│   ├── .env                    # Gemini API credentials
│   ├── main.py                 # FastAPI server, endpoints & static routing
│   ├── gemini_client.py        # Gemini API client (Q&A, summaries, quiz, mind maps)
│   ├── vector_store.py         # ChromaDB persistence & similarity queries
│   ├── chunking.py             # Sentence/paragraph aware text chunker
│   ├── ingestion.py            # High-fidelity PyMuPDF & multi-format parsers
│   ├── document_store.py       # SQLite database for documents & chat history
│   ├── exporter.py             # Microsoft Word (.docx) export builder
│   ├── data/                   # SQLite database storage (app.db)
│   └── chroma_db/              # ChromaDB vector collection
├── Frontend/
│   ├── index.html              # Multi-tab responsive SPA (Q&A, Summaries, Reader, Study Hub, Mind Map)
│   ├── app.js                  # Frontend controllers, Web Speech API, Mermaid.js & Exports
│   └── style.css               # Glassmorphic UI, 3D flip flashcards, and dark theme
├── requirements.txt            # Python dependencies
├── run.py                      # Server & browser launcher
├── start.bat                   # Windows batch script
└── README.md                   # Documentation
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Web UI |
| `GET` | `/api/health` | System health & model status |
| `POST` | `/upload` or `/api/upload` | Upload & index a document |
| `GET` | `/api/documents` | List all saved documents |
| `GET` | `/api/documents/{id}` | Get document metadata & full text |
| `DELETE` | `/api/documents/{id}` | Delete document & vector index |
| `POST` | `/api/summarize` | Generate document summary (4 styles) |
| `POST` | `/api/ask` | Ask a question with semantic RAG |
| `POST` | `/api/quiz` | Generate interactive revision quiz |
| `POST` | `/api/flashcards` | Generate revision flashcards |
| `POST` | `/api/cheatsheet` | Generate high-density revision cheat sheet |
| `POST` | `/api/mindmap` | Generate visual concept flowchart / mind map |
| `POST` | `/api/export/docx` | Download document notes as `.docx` |
| `GET` | `/api/documents/{id}/chat` | Retrieve chat history |
| `DELETE` | `/api/documents/{id}/chat` | Clear document chat history |
