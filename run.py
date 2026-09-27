"""
Launcher script for DocumentIQ.
Starts the FastAPI + ChromaDB backend and opens the Web UI in the default browser.
"""

import os
import sys
import time
import webbrowser
import threading
import uvicorn

# Ensure Backend directory is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(PROJECT_ROOT, "Backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

HOST = "127.0.0.1"
PORT = 8000
URL = f"http://{HOST}:{PORT}"


def open_browser():
    time.sleep(1.5)
    print(f"\n🚀 Opening DocumentIQ Web UI in browser: {URL}\n")
    webbrowser.open(URL)


if __name__ == "__main__":
    print("=" * 60)
    print("   DocumentIQ — Smart Document Q&A & Analyzer")
    print(f"   Server running at: {URL}")
    print("=" * 60)

    # Launch browser in a background thread
    threading.Thread(target=open_browser, daemon=True).start()

    # Start Uvicorn server
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True, app_dir=BACKEND_DIR)
