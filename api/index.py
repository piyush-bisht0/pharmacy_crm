import sys
import os

# Add backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# Use /tmp for SQLite on Vercel (only writable directory in serverless)
os.environ.setdefault("DATABASE_PATH", "/tmp/pharmacy.db")

from main import app  # noqa: E402
from mangum import Mangum  # noqa: E402

handler = Mangum(app, lifespan="off")
