# Quick Start Guide

## Installation (Windows)

### 1. Open Terminal in Backend Directory

```bash
cd c:\Users\kunal\Desktop\Projects\llm_meet_summarizer\backend
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Verify Environment Variable

Your `OLLAMA_API_KEY` is already set in system environment variables. Verify it:

```bash
echo %OLLAMA_API_KEY%
```

### 4. Start the Server

**Option A: Using the start script**
```bash
start.bat
```

**Option B: Directly with Python**
```bash
python main.py
```

**Option C: Using Uvicorn**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Access the API

Open your browser:
- **Swagger UI (Interactive Docs)**: http://localhost:8000/docs
- **API Root**: http://localhost:8000
- **Health Check**: http://localhost:8000/health

## Testing the API

### Using Swagger UI (Easiest Method)

1. Go to http://localhost:8000/docs
2. Click on **"POST /summarize"**
3. Click **"Try it out"** button
4. Click **"Choose File"** and select your `.vtt` file
5. Click **"Execute"**
6. Scroll down to see the response

### API Endpoints Available

| Endpoint | Description |
|----------|-------------|
| `POST /summarize` | Full pipeline (all stages) |
| `POST /summarize/stage0` | Meeting details only |
| `POST /summarize/stage1` | Segment summaries only |
| `POST /summarize/stage2` | Collective summary only |
| `POST /summarize/stage3` | Items extraction only |
| `POST /summarize/stage4` | Chapters only |
| `GET /health` | Health check |

## Expected Response

The full pipeline returns:

```json
{
  "meeting_details": {
    "title": "...",
    "date": "2025-01-15",
    "duration_ms": 3600000,
    "participants": ["Alice", "Bob"],
    "unknown_count": 0
  },
  "segment_summaries": [
    {
      "segment_id": "seg-0000",
      "summary": "Detailed summary...",
      "key_points": {
        "00:05": "Point 1",
        "02:30": "Point 2"
      }
    }
  ],
  "collective_summary": {
    "collective_summary": "Full meeting summary..."
  },
  "items": {
    "who_did_what": [...],
    "tasks": [...],
    "decisions": [...],
    "hats": [...],
    "achievements": [...],
    "blockers": [...]
  },
  "chapters": [
    {
      "chapter_id": "chap-000",
      "segment_ids": ["seg-0000", "seg-0001"],
      "title": "Chapter Title",
      "summary": "Chapter summary..."
    }
  ]
}
```

## Troubleshooting

### Port Already in Use

If port 8000 is already in use:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### Module Not Found Error

Make sure you're in the backend directory:

```bash
cd c:\Users\kunal\Desktop\Projects\llm_meet_summarizer\backend
```

Then reinstall dependencies:

```bash
pip install -r requirements.txt
```

### OLLAMA_API_KEY Not Found

If you get an error about missing API key:

1. Check system environment variable: `echo %OLLAMA_API_KEY%`
2. Or create a `.env` file in the backend directory:

```
OLLAMA_API_KEY=your_key_here
SEGMENTS_LLM_MODEL=gpt-oss:120b-cloud
```

## Performance Notes

- **Processing time**: Depends on meeting length
  - ~5-10 minutes for a 30-minute meeting
  - ~10-20 minutes for a 1-hour meeting
- Each stage includes retry logic (3 attempts)
- You can test individual stages to debug issues

## Next Steps

Once the backend is working:
1. Test with a sample VTT file
2. Verify all stages produce correct output
3. Move on to building the Next.js frontend

## Sample VTT File Format

Your VTT file should look like this:

```
WEBVTT

00:00:00.000 --> 00:00:05.000
<v Alice>Welcome everyone to the meeting.

00:00:05.000 --> 00:00:10.000
<v Bob>Thanks Alice. Let's start with the project updates.
```

## Support

If you encounter issues:
1. Check the terminal/console for error messages
2. Verify your OLLAMA_API_KEY is valid
3. Check the `/health` endpoint: http://localhost:8000/health
4. Review the error response from the API
