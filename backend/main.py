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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
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
    api_key = os.getenv("OLLAMA_API_KEY")
    return {
        "status": "healthy",
        "ollama_api_key_set": bool(api_key)
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


@app.post("/summarize/stage0")
async def summarize_stage0(
    file: UploadFile = File(..., description="VTT transcript file"),
    model: Optional[str] = Form(None, description="Model name (optional)")
):
    """
    Stage 0 only: Extract meeting details (title, date, participants).
    """
    if not file.filename.endswith(".vtt"):
        raise HTTPException(status_code=400, detail="File must be a .vtt transcript file")

    try:
        content = await file.read()
        vtt_content = content.decode("utf-8")

        from utils.vtt_parser import parse_vtt
        from stages.stage0_meeting_details import infer_meeting_details

        utterances = parse_vtt(vtt_content)
        if not utterances:
            raise HTTPException(status_code=400, detail="No utterances found in VTT file")

        meeting_details = infer_meeting_details(utterances, model=model)
        return JSONResponse(content=meeting_details)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.post("/summarize/stage1")
async def summarize_stage1(
    file: UploadFile = File(..., description="VTT transcript file"),
    model: Optional[str] = Form(None, description="Model name (optional)"),
    segment_len_ms: int = Form(600000, description="Segment length in milliseconds")
):
    """
    Stage 1 only: Summarize segments with key points.
    """
    if not file.filename.endswith(".vtt"):
        raise HTTPException(status_code=400, detail="File must be a .vtt transcript file")

    try:
        content = await file.read()
        vtt_content = content.decode("utf-8")

        from utils.vtt_parser import parse_vtt
        from stages.segmentation import segment_utterances
        from stages.stage1_summaries import summarize_segments

        utterances = parse_vtt(vtt_content)
        if not utterances:
            raise HTTPException(status_code=400, detail="No utterances found in VTT file")

        segments = segment_utterances(utterances, segment_len_ms=segment_len_ms)
        segment_summaries = summarize_segments(segments, model=model)

        return JSONResponse(content={"segment_summaries": segment_summaries})

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.post("/summarize/stage2")
async def summarize_stage2(
    file: UploadFile = File(..., description="VTT transcript file"),
    model: Optional[str] = Form(None, description="Model name (optional)"),
    segment_len_ms: int = Form(600000, description="Segment length in milliseconds")
):
    """
    Stage 2 only: Create collective summary.
    """
    if not file.filename.endswith(".vtt"):
        raise HTTPException(status_code=400, detail="File must be a .vtt transcript file")

    try:
        content = await file.read()
        vtt_content = content.decode("utf-8")

        from utils.vtt_parser import parse_vtt
        from stages.segmentation import segment_utterances
        from stages.stage1_summaries import summarize_segments
        from stages.stage2_collective import summarize_collective

        utterances = parse_vtt(vtt_content)
        if not utterances:
            raise HTTPException(status_code=400, detail="No utterances found in VTT file")

        segments = segment_utterances(utterances, segment_len_ms=segment_len_ms)
        segment_summaries = summarize_segments(segments, model=model)
        collective_summary = summarize_collective(segment_summaries, model=model)

        return JSONResponse(content=collective_summary)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.post("/summarize/stage3")
async def summarize_stage3(
    file: UploadFile = File(..., description="VTT transcript file"),
    model: Optional[str] = Form(None, description="Model name (optional)"),
    segment_len_ms: int = Form(600000, description="Segment length in milliseconds")
):
    """
    Stage 3 only: Extract items (tasks, decisions, who did what, hats, achievements, blockers).
    """
    if not file.filename.endswith(".vtt"):
        raise HTTPException(status_code=400, detail="File must be a .vtt transcript file")

    try:
        content = await file.read()
        vtt_content = content.decode("utf-8")

        from utils.vtt_parser import parse_vtt
        from stages.segmentation import segment_utterances
        from stages.stage1_summaries import summarize_segments
        from stages.stage3_items import extract_items

        utterances = parse_vtt(vtt_content)
        if not utterances:
            raise HTTPException(status_code=400, detail="No utterances found in VTT file")

        segments = segment_utterances(utterances, segment_len_ms=segment_len_ms)
        segment_summaries = summarize_segments(segments, model=model)
        items = extract_items(segment_summaries, model=model)

        return JSONResponse(content=items)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.post("/summarize/stage4")
async def summarize_stage4(
    file: UploadFile = File(..., description="VTT transcript file"),
    model: Optional[str] = Form(None, description="Model name (optional)"),
    segment_len_ms: int = Form(600000, description="Segment length in milliseconds")
):
    """
    Stage 4 only: Create chapters by clustering similar topics.
    """
    if not file.filename.endswith(".vtt"):
        raise HTTPException(status_code=400, detail="File must be a .vtt transcript file")

    try:
        content = await file.read()
        vtt_content = content.decode("utf-8")

        from utils.vtt_parser import parse_vtt
        from stages.segmentation import segment_utterances
        from stages.stage1_summaries import summarize_segments
        from stages.stage4_chapters import build_chapters

        utterances = parse_vtt(vtt_content)
        if not utterances:
            raise HTTPException(status_code=400, detail="No utterances found in VTT file")

        segments = segment_utterances(utterances, segment_len_ms=segment_len_ms)
        segment_summaries = summarize_segments(segments, model=model)
        chapters = build_chapters(segment_summaries, model=model)

        return JSONResponse(content={"chapters": chapters})

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
