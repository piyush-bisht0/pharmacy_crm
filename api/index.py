import sys
import os

# Add backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# Use /tmp for SQLite on Vercel (only writable directory in serverless)
os.environ.setdefault("DATABASE_PATH", "/tmp/pharmacy.db")

from main import app  # noqa: E402
from mangum import Mangum  # noqa: E402


# Strip /api prefix so FastAPI routes match correctly
class StripApiPrefix:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope["path"]
            if path.startswith("/api"):
                scope["path"] = path[4:] or "/"
        await self.app(scope, receive, send)


handler = Mangum(StripApiPrefix(app), lifespan="off")
