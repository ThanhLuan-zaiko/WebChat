"""
File upload endpoints.
"""
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import mimetypes

router = APIRouter()

# Upload directory
UPLOAD_DIR = Path(__file__).parent.parent.parent.parent / "uploads"


@router.get("/{chat_id}/{filename}")
async def get_file(chat_id: str, filename: str):
    """
    Serve uploaded files from chat-specific folders.
    """
    file_path = UPLOAD_DIR / chat_id / filename
    
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Detect MIME type
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if mime_type is None:
        mime_type = "application/octet-stream"
    
    return FileResponse(
        path=file_path,
        media_type=mime_type,
        filename=filename
    )
