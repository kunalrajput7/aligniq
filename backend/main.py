"""
FastAPI application for meeting summarization.
"""
import os
from typing import Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from pipeline import run_pipeline_async
from models import PipelineResponse

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Meeting Summarizer API",
    description="API for summarizing meeting transcripts using Ollama Cloud LLM",
    version="1.0.0"
)

# Configure CORS
# Allow requests from local development and production Vercel frontend
allowed_origins = [
    "https://summer-ai-studio.vercel.app",
    "http://localhost:3000",  # Local development
    "http://localhost:3001",  # Alternative local port
    # "https://your-custom-domain.com",
]


# In development, allow all origins for testing
if os.getenv("ENVIRONMENT") == "development":
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Meeting Summarizer API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "summarize": "/summarize (POST)",
            "docs": "/docs",
            "redoc": "/redoc"
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    azure_key = os.getenv("AZURE_AI_KEY")
    azure_endpoint = os.getenv("AZURE_AI_ENDPOINT")
    azure_deployment = os.getenv("AZURE_AI_DEPLOYMENT")

    return {
        "status": "healthy",
        "azure_ai_configured": bool(azure_key and azure_endpoint and azure_deployment),
        "azure_ai_endpoint": azure_endpoint if azure_endpoint else "Not configured",
        "azure_ai_deployment": azure_deployment if azure_deployment else "Not configured"
    }


@app.post("/summarize", response_model=PipelineResponse)
async def summarize_meeting(
    file: UploadFile = File(..., description="VTT transcript file"),
    model: Optional[str] = Form(None, description="Model name (optional)"),
    segment_len_ms: int = Form(600000, description="Segment length in milliseconds (default: 10 minutes)")
):
    """
    Summarize a meeting transcript from a VTT file.

    This endpoint runs the complete pipeline:
    - Stage 0: Extract meeting details (title, date, participants)
    - Stage 1: Summarize each 10-minute segment with key points
    - Stage 2: Create collective summary of entire meeting
    - Stage 3: Extract items (tasks, decisions, who did what, hats, achievements, blockers)
    - Stage 4: Create chapters by clustering similar topics

    Args:
        file: VTT transcript file (.vtt)
        model: Model name (optional, defaults to env SEGMENTS_LLM_MODEL)
        segment_len_ms: Segment length in milliseconds (default: 600000 = 10 minutes)

    Returns:
        PipelineResponse with all extracted information
    """
    # Validate file type
    if not file.filename.endswith(".vtt"):
        raise HTTPException(
            status_code=400,
            detail="File must be a .vtt transcript file"
        )

    try:
        # Read file content
        content = await file.read()
        vtt_content = content.decode("utf-8")

        # Run async pipeline
        result = await run_pipeline_async(
            vtt_content=vtt_content,
            model=model,
            segment_len_ms=segment_len_ms
        )

        # Check for errors
        if "error" in result:
            raise HTTPException(
                status_code=400,
                detail=result["error"]
            )

        return JSONResponse(content=result)

    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="File must be UTF-8 encoded"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
