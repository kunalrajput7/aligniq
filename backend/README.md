# Meeting Summarizer Backend

FastAPI backend for summarizing meeting transcripts using Ollama Cloud LLM (gpt-oss:120b-cloud).

## Features

- **Stage 0**: Extract meeting details (title, date, participants)
- **Stage 1**: Summarize 10-minute segments with timeline key points
- **Stage 2**: Create comprehensive collective summary
- **Stage 3**: Extract items:
  - Who did what
  - Tasks assigned
  - Decisions made
  - Six Thinking Hats analysis
  - Achievements
  - Blockers
- **Stage 4**: Create chapters by clustering similar topics

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Set Environment Variables

The `OLLAMA_API_KEY` is already set in your system environment variables.

Optionally, create a `.env` file to override defaults:

```bash
OLLAMA_API_KEY=your_api_key_here
SEGMENTS_LLM_MODEL=gpt-oss:120b-cloud
SEGMENTS_MAX_CHARS=14000
SEGMENTS_COLLECTIVE_MAX_CHARS=16000
SEGMENTS_ITEMS_MAX_CHARS=16000
SEGMENTS_CHAPTERS_MAX_CHARS=20000
```

### 3. Run the Server

```bash
python main.py
```

Or with uvicorn:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Interactive docs (Swagger UI): http://localhost:8000/docs
- Alternative docs (ReDoc): http://localhost:8000/redoc

## API Endpoints

### Main Endpoint

**POST /summarize**
- Upload a VTT transcript file
- Runs all stages (0-4) in sequence
- Returns complete analysis

**Parameters:**
- `file`: VTT file (required)
- `model`: Model name (optional, default: gpt-oss:120b-cloud)
- `segment_len_ms`: Segment length in milliseconds (optional, default: 600000 = 10 minutes)

### Individual Stage Endpoints

Run specific stages individually:

- **POST /summarize/stage0** - Meeting details only
- **POST /summarize/stage1** - Segment summaries only
- **POST /summarize/stage2** - Collective summary only
- **POST /summarize/stage3** - Items extraction only
- **POST /summarize/stage4** - Chapters only

### Health Check

**GET /health**
- Check API health and environment setup

## Usage Example

### Using Swagger UI (Recommended)

1. Navigate to http://localhost:8000/docs
2. Click on "POST /summarize"
3. Click "Try it out"
4. Upload your VTT file
5. Click "Execute"
6. View the results

### Using curl

```bash
curl -X POST "http://localhost:8000/summarize" \
  -F "file=@your_meeting.vtt"
```

### Using Python

```python
import requests

url = "http://localhost:8000/summarize"
files = {"file": open("your_meeting.vtt", "rb")}

response = requests.post(url, files=files)
result = response.json()

print(result["meeting_details"])
print(result["collective_summary"])
print(result["items"])
print(result["chapters"])
```

## Response Structure

```json
{
  "meeting_details": {
    "title": "Project Planning Session",
    "date": "2025-01-15",
    "duration_ms": 3600000,
    "participants": ["Alice", "Bob", "Charlie"],
    "unknown_count": 0
  },
  "segment_summaries": [
    {
      "segment_id": "seg-0000",
      "summary": "Detailed summary...",
      "key_points": {
        "00:05": "Project kickoff",
        "02:30": "Budget discussion"
      }
    }
  ],
  "collective_summary": {
    "collective_summary": "Comprehensive meeting summary..."
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
      "title": "Project Planning",
      "summary": "Chapter summary..."
    }
  ]
}
```

## Project Structure

```
backend/
├── main.py                          # FastAPI application
├── pipeline.py                      # Pipeline orchestrator
├── models.py                        # Pydantic schemas
├── requirements.txt                 # Dependencies
├── .env.example                     # Example environment file
├── stages/                          # Stage implementations
│   ├── __init__.py
│   ├── common.py                    # Shared utilities
│   ├── segmentation.py              # Utterance segmentation
│   ├── stage0_meeting_details.py   # Meeting details
│   ├── stage1_summaries.py         # Segment summaries
│   ├── stage2_collective.py        # Collective summary
│   ├── stage3_items.py             # Items extraction
│   └── stage4_chapters.py          # Chapter generation
└── utils/                           # Utilities
    ├── __init__.py
    └── vtt_parser.py                # VTT parser
```

## Six Thinking Hats

The system analyzes meeting contributions using Edward de Bono's Six Thinking Hats:

- **White Hat**: Data, facts, information gathering
- **Red Hat**: Emotions, feelings, intuition
- **Black Hat**: Caution, difficulties, critical thinking
- **Yellow Hat**: Positivity, benefits, optimism
- **Green Hat**: Creativity, alternatives, new ideas
- **Blue Hat**: Process, control, organization, planning

## Notes

- The API uses Ollama Cloud (https://ollama.com) with the gpt-oss:120b-cloud model
- Ensure `OLLAMA_API_KEY` is set in your environment
- VTT files must be UTF-8 encoded
- Processing time depends on meeting length and model response time
- Each stage includes retry logic (3 attempts) for robustness

## Troubleshooting

### API Key Not Set
```
Error: OLLAMA_API_KEY is not set
```
Solution: Set the environment variable or add it to `.env`

### No Utterances Found
```
Error: No utterances found in VTT file
```
Solution: Ensure your VTT file is properly formatted with timestamps and speaker labels

### Model Error
```
Error: Ollama Cloud error: ...
```
Solution: Check your API key and model name, ensure you have credits/access
