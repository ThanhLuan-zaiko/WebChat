from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from fastapi.middleware.cors import CORSMiddleware

from app.core import settings, init_db, close_db, get_db
from app.api.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for FastAPI application.
    Handles startup and shutdown events.
    """
    # Startup: Initialize database connection
    await init_db()
    print(f"✅ App startup: Connected to database at {settings.DATABASE_URL}")
    yield
    # Shutdown: Close database connection
    await close_db()
    print("🛑 App shutdown: Database connection closed")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Trong production nên set cụ thể domain Frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running"
    }


@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Health check endpoint.
    Verifies database connection.
    """
    try:
        # Execute a simple query to check DB connection
        result = await db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
            "result": result.scalar()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)