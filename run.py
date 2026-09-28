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


def wait_and_open_browser():
    """Waits until the FastAPI server is responsive before opening the browser."""
    for _ in range(30):
        time.sleep(0.5)
        try:
            with urllib.request.urlopen(f"{URL}/api/health", timeout=1) as resp:
                if resp.status == 200:
                    break
        except Exception:
            pass

    print(f"\n🚀 Opening DocumentIQ Web UI in browser: {URL}\n")
    webbrowser.open(URL)


if __name__ == "__main__":
    print("=" * 60)
    print("   DocumentIQ — Smart Document Q&A & Analyzer")
    print(f"   Server running at: {URL}")
    print("=" * 60)

    # Launch browser in a background thread once server is ready
    threading.Thread(target=wait_and_open_browser, daemon=True).start()

    # Determine if reload was explicitly requested
    is_dev_reload = "--reload" in sys.argv

    # Start Uvicorn server (reload=False by default prevents unwanted worker kills when ChromaDB or SQLite writes)
    if is_dev_reload:
        uvicorn.run(
            "main:app",
            host=HOST,
            port=PORT,
            reload=True,
            reload_dirs=[BACKEND_DIR],
            reload_includes=["*.py"],
            reload_excludes=["*.db*", "data*", "chroma_db*", "*.sqlite*", "*.log"],
            app_dir=BACKEND_DIR,
        )
    else:
        uvicorn.run("main:app", host=HOST, port=PORT, reload=False, app_dir=BACKEND_DIR)
