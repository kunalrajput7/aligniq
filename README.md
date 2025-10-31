# LLM Meeting Summarizer

**An AI-powered meeting intelligence platform that transforms Microsoft Teams `.vtt` transcripts into interactive dashboards with summaries, action items, achievements, blockers, Six Thinking Hats analysis, and navigable mind maps.**

---

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Architecture](#architecture)
4. [Backend Pipeline Deep Dive](#backend-pipeline-deep-dive)
5. [Frontend Dashboard Experience](#frontend-dashboard-experience)
6. [Installation & Setup](#installation--setup)
7. [Running the Application](#running-the-application)
8. [API Reference](#api-reference)
9. [Data Schemas](#data-schemas)
10. [Project Structure](#project-structure)
11. [Technology Stack](#technology-stack)
12. [Configuration](#configuration)
13. [Development Notes](#development-notes)
14. [Future Enhancements](#future-enhancements)

---

## Overview

The **LLM Meeting Summarizer** is a full-stack application designed to extract actionable insights from meeting transcripts. It processes Microsoft Teams `.vtt` files through a sophisticated multi-stage AI pipeline and presents the results in a beautiful, interactive web dashboard.

### What It Does

- **Parses VTT Transcripts**: Converts Microsoft Teams transcript files into structured data
- **Intelligent Segmentation**: Breaks long meetings into digestible chunks (default: 10 minutes)
- **AI-Powered Analysis**: Uses large language models (Ollama Cloud) to generate:
  - Executive meeting summaries with markdown formatting
  - Action items with owners, deadlines, and confidence scores
  - Achievements and blockers with evidence from the transcript
  - Six Thinking Hats personality analysis for each participant
  - Thematic chapters with automatic clustering
  - Interactive mind maps showing meeting structure and relationships
- **Rich Visualization**: Modern web interface with:
  - Clean, aesthetic design with Ubuntu font
  - Dark mode support
  - Custom scrollbars and smooth animations
  - Exportable mind maps (JSON, PNG, PDF)
  - Responsive layout optimized for different screen sizes

### Use Cases

- **Team Leaders**: Quickly review what was discussed, decided, and assigned
- **Remote Workers**: Catch up on meetings they missed
- **Project Managers**: Track action items and blockers across meetings
- **Executives**: Get high-level summaries without watching full recordings
- **Documentation**: Generate meeting minutes automatically

---

## Key Features

### 🎯 Comprehensive Meeting Analysis

- **Meeting Details Extraction**: Automatically identifies meeting title, date, duration, and participants
- **Narrative Summaries**: AI-generated executive summaries with proper markdown formatting
- **Action Item Tracking**: Identifies tasks with owners, deadlines, status, and confidence levels
- **Achievement Recognition**: Highlights accomplishments mentioned during the meeting
- **Blocker Identification**: Surfaces obstacles and challenges with responsible parties
- **Evidence Linking**: Provides timestamps and quotes supporting extracted insights

### 🎨 Six Thinking Hats Analysis

Applies Edward de Bono's Six Thinking Hats framework to analyze each participant's contribution style:

- **🔵 Blue Hat (Facilitator)**: Controls the meeting, sets agenda
- **⚪ White Hat (Information)**: Focuses on facts and data
- **🔴 Red Hat (Emotions)**: Expresses feelings and intuitions
- **🟡 Yellow Hat (Optimism)**: Highlights benefits and opportunities
- **⚫ Black Hat (Caution)**: Points out risks and concerns
- **🟢 Green Hat (Creativity)**: Proposes ideas and alternatives

### 📚 Smart Chapter Generation

- Uses TF-IDF and cosine similarity to cluster related segments
- Groups similar discussion topics into logical chapters
- Generates descriptive titles and summaries for each chapter
- Provides easy navigation through long meetings

### 🗺️ Interactive Mind Map

- Hierarchical visualization of meeting structure
- Node types: Root, Topics, Decisions, Action Items, Questions
- Hover tooltips with descriptions and timestamps
- Visual legend with color-coded node types
- Export capabilities:
  - **JSON**: Raw data for further processing
  - **PNG**: High-quality image for presentations
  - **PDF**: Printable document for distribution

### 🎨 Modern UI/UX

- **Clean Design**: Titles and icons outside card boxes for better visual hierarchy
- **Responsive Layout**: Three-column layout with adjustable widths
- **Smart Typography**: Ubuntu font with strategic use of bold (700), regular (400), and light (300) weights
- **Custom Scrollbars**: Aesthetic thin scrollbars matching the design system
- **Smooth Interactions**: Hover effects, transitions, and loading animations
- **Conditional Views**: To-do sidebar hidden on mindmap view for full-width visualization

---

## Architecture

The application follows a modern full-stack architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 14)                  │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ File Upload│  │  Dashboard   │  │  Visualizations  │   │
│  │   Widget   │─▶│   (3 tabs)   │─▶│  (Mindmap, etc.) │   │
│  └────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST API (HTTP)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Backend (FastAPI)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Pipeline Orchestrator                     │ │
│  │  (Async parallel execution with asyncio.gather)       │ │
│  └───┬────────────────────────────────────────────────────┘ │
│      │                                                       │
│  ┌───▼────┬──────┬──────┬──────┬──────┬──────┐            │
│  │ Parse  │ Seg  │ St1  │ St2  │ St3  │ St4  │ St5 │      │
│  │  VTT   │ment  │Summ  │Coll  │Hats  │Chap  │Mind│      │
│  └────────┴──────┴──────┴──────┴──────┴──────┴─────┘      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ HTTP API
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  Ollama Cloud API                            │
│              (gpt-oss:120b-cloud model)                      │
└──────────────────────────────────────────────────────────────┘
```

### Component Roles

- **Frontend**: React-based UI for upload, visualization, and interaction
- **Backend**: FastAPI service orchestrating the AI pipeline
- **Pipeline**: Async execution engine managing stage dependencies
- **Stages**: Modular processing units (parsing, segmentation, summarization, analysis)
- **LLM Provider**: Ollama Cloud API for AI-powered text generation

---

## Backend Pipeline Deep Dive

The backend pipeline (`backend/pipeline.py`) orchestrates a multi-stage process with intelligent parallel execution using Python's `asyncio`.

### Pipeline Execution Flow

```
1. Parse VTT → Extract utterances with timestamps
        ↓
2. Segment → Divide into 10-minute windows
        ↓
3. Stage 1 → Summarize each segment (parallel)
        ↓
    ┌───┴───┬────────┬────────┐
    ↓       ↓        ↓        ↓
  Stage 2  Stage 3  Stage 4  (run in parallel)
 Collective Hats   Chapters
    └───┬───┴────────┴────────┘
        ↓
4. Stage 5 → Build mind map
        ↓
    Return complete response
```

### Stage Breakdown

#### **Parsing Stage** (`utils/vtt_parser.py`)

**Purpose**: Transform raw `.vtt` files into structured data

**Input**: VTT file content (string)

**Output**: List of utterances
```python
{
  "start_ms": 12000,      # Start time in milliseconds
  "end_ms": 15500,        # End time in milliseconds
  "speaker": "Alice",     # Speaker name
  "text": "Let's begin"   # Spoken text
}
```

**Key Features**:
- Handles Microsoft Teams VTT format
- Extracts speaker names and timestamps
- Handles "Speaker ?" for unidentified speakers
- Validates and cleans text content

---

#### **Segmentation Stage** (`stages/segmentation.py`)

**Purpose**: Break long transcripts into manageable chunks

**Input**: List of utterances

**Output**: List of segments (default: 10-minute windows)
```python
{
  "id": "seg-0000",
  "window_start_ms": 0,
  "window_end_ms": 600000,
  "text": "HH:MM:SS | Speaker | Text\n...",
  "utterance_range": [0, 15]  # Original utterance indices
}
```

**Configuration**:
- `segment_len_ms`: Window size (default: 600,000ms = 10 minutes)
- `overlap_ratio`: Optional overlap between segments (default: 0.0)

**Why Segmentation?**
- LLMs have token limits; segmentation ensures we stay within bounds
- Parallel processing: Multiple segments can be summarized concurrently
- Better granularity: Provides minute-by-minute detail

---

#### **Stage 1: Segment Summaries** (`stages/stage1_summaries.py`)

**Purpose**: Generate detailed summaries and key points for each segment

**Input**: List of segments

**Output**: List of segment summaries
```python
{
  "segment_id": "seg-0000",
  "summary": "The team discussed Q3 goals and assigned tasks...",
  "key_points": {
    "02:15": "Decision to launch beta in June",
    "05:30": "Sara raised concerns about API latency"
  }
}
```

**LLM Prompt Strategy**:
- Requests structured JSON output
- Enforces timeline-based key points with timestamps
- Includes retry logic (max 3 attempts) for malformed responses
- Truncates input to stay within `SEGMENTS_MAX_CHARS` limit

**Parallel Execution**: All segments are summarized concurrently using `asyncio.gather()` for maximum performance.

---

#### **Stage 2: Collective Summary** (`stages/stage2_collective.py`)

**Purpose**: Generate executive-level summary and extract structured insights

**Input**:
- Original utterances (for context)
- Segment summaries (for detail)

**Output**: Comprehensive meeting analysis
```python
{
  "meeting_title": "Q3 Planning Session",     # 8 words max
  "meeting_date": "2024-06-15",               # YYYY-MM-DD or null
  "narrative_summary": "**Overview**\n...",   # Markdown formatted
  "action_items": [
    {
      "task": "Review API documentation",
      "owner": "Dev Team",
      "deadline": "2024-06-20",
      "status": "pending",
      "confidence": 0.85
    }
  ],
  "achievements": [
    {
      "achievement": "Closed 10 customer deals",
      "member": "Sales Team",
      "confidence": 0.9,
      "evidence": [
        {"t": "12:34", "quote": "We finalized the contracts"}
      ]
    }
  ],
  "blockers": [
    {
      "blocker": "Database migration delays",
      "member": "Backend Team",
      "owner": "DevOps",
      "confidence": 0.75,
      "evidence": [
        {"t": "18:22", "quote": "Migration is blocked by..."}
      ]
    }
  ]
}
```

**Key Features**:
- **Meeting Context**: Extracts first ~80 utterances for meeting title/date inference
- **Evidence Tracking**: Links insights to specific timestamps with quotes
- **Confidence Scoring**: Rates certainty of extracted information (0.0-1.0)
- **Markdown Support**: Narrative summary uses proper markdown formatting
- **Title Validation**: Limits meeting titles to 8 words for brevity

**Why This Stage Was Refactored**:
Previously, meeting details (title/date) were in a separate "Stage 0". We merged it into Stage 2 because:
- Reduces API calls (one less LLM request)
- Better context: Stage 2 already processes the full meeting
- Simpler architecture: One stage for all collective insights

---

#### **Stage 3: Six Thinking Hats** (`stages/stage3_supplementary.py`)

**Purpose**: Analyze each participant's communication style using Six Thinking Hats framework

**Input**: Segment summaries

**Output**: Hat assignments per speaker
```python
[
  {
    "speaker": "Alice",
    "hat": "blue",
    "evidence": "Facilitated agenda, summarized action items",
    "confidence": 0.85
  },
  {
    "speaker": "Bob",
    "hat": "green",
    "evidence": "Proposed innovative solutions to API problem",
    "confidence": 0.78
  }
]
```

**Hat Types**:
- `blue`: Facilitator/organizer
- `white`: Fact-focused/data-driven
- `red`: Emotion-driven/intuitive
- `yellow`: Optimistic/benefit-focused
- `black`: Cautious/critical
- `green`: Creative/idea-generating

**Frontend Display**: Shows dominant hat for each participant with visual color coding and modal legend.

---

#### **Stage 4: Chapter Generation** (`stages/stage4_chapters.py`)

**Purpose**: Group related discussion topics into logical chapters

**Input**: Segment summaries

**Output**: List of chapters
```python
[
  {
    "chapter_id": "chap-000",
    "segment_ids": ["seg-0000", "seg-0001", "seg-0002"],
    "title": "Product Roadmap Discussion",
    "summary": "The team aligned on Q3 feature priorities..."
  }
]
```

**Two-Step Process**:

1. **Clustering** (Python, no LLM):
   - Uses TF-IDF vectorization on segment summaries
   - Calculates cosine similarity between segments
   - Groups similar segments using threshold-based clustering
   - Deterministic and fast

2. **Polishing** (LLM):
   - Generates human-readable chapter title
   - Creates cohesive summary from clustered segments
   - Maintains chronological order

**Configuration**:
- `SEGMENTS_CHAPTERS_MAX_CHARS`: Max input size for LLM
- Clustering threshold: Adjustable similarity cutoff

---

#### **Stage 5: Mind Map Generation** (`stages/stage5_mindmap.py`)

**Purpose**: Create hierarchical visualization data structure

**Input**:
- Collective summary (for meeting title)
- Chapters (for structure)

**Output**: Graph data structure
```python
{
  "center_node": {
    "id": "root",
    "label": "Q3 Planning Session",
    "type": "root"
  },
  "nodes": [
    {
      "id": "topic-1",
      "label": "Feature Prioritization",
      "type": "topic",
      "parent_id": "root",
      "timestamp": "05:20",
      "description": "Discussion of Q3 feature roadmap"
    },
    {
      "id": "action-1",
      "label": "Review API docs",
      "type": "action",
      "parent_id": "topic-1",
      "timestamp": "08:15",
      "description": "Action item for dev team"
    }
  ],
  "edges": [
    {"from": "root", "to": "topic-1", "type": "contains"},
    {"from": "topic-1", "to": "action-1", "type": "leads_to"}
  ]
}
```

**Node Types**:
- `root`: Meeting title (center node)
- `topic`: Major discussion themes from chapters
- `decision`: Key decisions made
- `action`: Action items extracted
- `question`: Open questions or concerns

**LLM Strategy**:
- Analyzes collective summary and chapters
- Identifies relationships and hierarchy
- Generates structured JSON with IDs, labels, types, and connections

**Frontend Rendering**: Uses `react-d3-tree` for interactive visualization with zoom, pan, and hover tooltips.

---

### Pipeline Performance Optimizations

1. **Parallel Stage Execution**: Stages 2, 3, and 4 run concurrently after Stage 1
2. **Async I/O**: All LLM calls use `asyncio` for non-blocking network requests
3. **Batch Processing**: Stage 1 processes all segments in parallel
4. **Early Returns**: Pipeline returns partial results if a stage fails
5. **Input Truncation**: Smart text truncation prevents token limit errors

---

## Frontend Dashboard Experience

The frontend is built with Next.js 14, React, and Tailwind CSS, providing a modern and responsive interface.

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Meeting Name              Date | Duration | Participants│
├─────────────────────────────────────────────────────────┤
│ ┌────────┬────────────────────────────────┬───────────┐ │
│ │ Nav    │  Main Content Area            │  To-Do's  │ │
│ │ ├─────┤│                               │           │ │
│ │ │Over-│││  • Meeting Summary           │  1. Task  │ │
│ │ │view ││├──────────────────────────────┤│  2. Task  │ │
│ │ ├─────┤││  • Deadlines                 │  3. Task  │ │
│ │ │Chap-│││  • Achievements | Blockers   │  ...      │ │
│ │ │ters │││  • Six Thinking Hats         │           │ │
│ │ ├─────┤│                               │           │ │
│ │ │Mind-││                               │           │ │
│ │ │map  ││                               │           │ │
│ └────────┴────────────────────────────────┴───────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Column Widths

- **Left Sidebar (Navigation)**: 224px (14rem / w-56)
- **Main Content Area**: Flexible, max 768px (max-w-3xl)
- **Right Sidebar (To-Do's)**: 384px (24rem / w-96)
- **Gap Between Columns**: 20px (1.25rem / gap-5)

### Key UI Components

#### **File Upload Widget**
- Drag-and-drop zone with visual feedback
- File type validation (`.vtt` only)
- Animated loading state during processing
- Error handling with user-friendly messages

#### **Meeting Header**
- Horizontal layout without card background
- Meeting title on left (3xl, bold)
- Metadata on right (date, duration, participants)
- Clean border-bottom separator

#### **Overview Tab**
- **Meeting Summary**: Markdown-rendered narrative with rich typography
- **Upcoming Deadlines**: Filtered action items with dates
- **Achievements**: Yellow-themed cards with evidence and confidence
- **Blockers**: Red-themed cards with responsible parties
- **Six Thinking Hats**: Color-coded participant analysis

#### **Chapters Tab**
- Numbered chapter cards
- AI-generated titles and summaries
- Chronological order

#### **Mindmap Tab**
- Interactive D3 tree visualization
- Export dropdown (JSON, PNG, PDF)
- Hover tooltips with descriptions
- Legend overlay (top-right corner)

#### **To-Do Sidebar**
- Numbered list format (1., 2., 3., ...)
- Owner badges if assigned
- Custom aesthetic scrollbar
- Hidden on mindmap view

### Typography System

**Ubuntu font** with strategic weight usage:
- **Bold (700)**: Headers, buttons, navigation
- **Regular (400)**: Body text, general content
- **Light (300)**: Secondary text, timestamps

### Custom Scrollbars

- Width: 6px (thin)
- Primary color with opacity
- Hover effects
- Firefox compatibility

---

## Installation & Setup

### Prerequisites

- **Python 3.11+**: Backend runtime
- **Node.js 18+**: Frontend runtime
- **npm or yarn**: Package manager
- **Ollama Cloud API Key**: For LLM access

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv .venv

# Windows
.\.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment:

Create `backend/.env`:
```ini
OLLAMA_API_KEY=your_api_key_here
SEGMENTS_LLM_MODEL=gpt-oss:120b-cloud
SEGMENTS_MAX_CHARS=14000
SEGMENTS_COLLECTIVE_MAX_CHARS=16000
SEGMENTS_ITEMS_MAX_CHARS=16000
SEGMENTS_CHAPTERS_MAX_CHARS=20000
```

### Frontend Setup

1. Navigate to frontend:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:

Create `frontend/.env.local`:
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Running the Application

### Start Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### Start Frontend

```bash
cd frontend
npm run dev
```

### Access Application

Open browser: `http://localhost:3000`

---

## API Reference

### Endpoints

#### **GET /**
Welcome message and API metadata

#### **GET /health**
Health check and configuration status

#### **POST /summarize**
Complete pipeline execution

**Request** (multipart/form-data):
- `file`: VTT file (required)
- `model`: Model override (optional)
- `segment_len_ms`: Segment length (optional, default: 600000)

**Response**: See [Data Schemas](#data-schemas)

---

## Data Schemas

### Pipeline Response

```typescript
{
  meeting_details: {
    title: string,
    date: string | null,
    duration_ms: number,
    participants: string[],
    unknown_count: number
  },
  segments: [...],
  segment_summaries: [...],
  collective_summary: {
    narrative_summary: string,
    action_items: [...],
    achievements: [...],
    blockers: [...]
  },
  hats: [...],
  chapters: [...],
  mindmap: {
    center_node: {...},
    nodes: [...],
    edges: [...]
  }
}
```

Full schema definitions in `frontend/types/api.ts`

---

## Project Structure

```
llm_meet_summarizer/
├── backend/
│   ├── main.py
│   ├── pipeline.py
│   ├── models.py
│   ├── stages/
│   ├── utils/
│   └── requirements.txt
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── types/
│   ├── public/
│   └── package.json
└── README.md
```

---

## Technology Stack

### Backend
- Python 3.11+, FastAPI, Uvicorn
- asyncio, httpx, scikit-learn
- Pydantic, python-dotenv

### Frontend
- Next.js 14, React 18, TypeScript 5
- Tailwind CSS 3, shadcn/ui
- react-d3-tree, react-markdown, jsPDF
- lucide-react icons

### AI/LLM
- Ollama Cloud (gpt-oss:120b-cloud)

---

## Configuration

### Backend Environment Variables

| Variable | Default | Required |
|----------|---------|----------|
| `OLLAMA_API_KEY` | - | Yes |
| `SEGMENTS_LLM_MODEL` | gpt-oss:120b-cloud | No |
| `SEGMENTS_MAX_CHARS` | 14000 | No |
| `SEGMENTS_COLLECTIVE_MAX_CHARS` | 16000 | No |

### Frontend Environment Variables

| Variable | Default | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_API_URL` | http://localhost:8000 | Yes |

---

## Development Notes

### Code Quality
- Type safety with Pydantic and TypeScript
- Graceful error handling
- Input validation at API boundary

### Security Considerations (Production)
- Restrict CORS origins
- Use secret management for API keys
- Add authentication (JWT, OAuth)
- Implement rate limiting
- Enforce HTTPS

### Performance
- Parallel stage execution
- Async I/O throughout
- Consider caching for repeated requests

---

## Future Enhancements

### High Priority
1. Persistent storage (database)
2. User authentication
3. PDF export of full summary
4. Real-time processing updates

### Medium Priority
5. Multi-format support (Zoom, Google Meet)
6. Enhanced visualizations (timeline, charts)
7. Collaboration features (comments, assignments)
8. Advanced AI features (multi-meeting analysis)

### Low Priority
9. UI customization (themes, fonts)
10. Developer tools (Docker, CI/CD)
11. Analytics dashboard
12. Internationalization

---

## Troubleshooting

**Issue**: API key not found
- **Solution**: Create `.env` file with valid key

**Issue**: Frontend can't reach backend
- **Solution**: Check backend is running, verify `NEXT_PUBLIC_API_URL`

**Issue**: VTT file rejected
- **Solution**: Verify valid Teams format, check extension

**Issue**: LLM response errors
- **Solution**: Reduce `SEGMENTS_*_MAX_CHARS` or segment length

---

## License

This project is proprietary. All rights reserved.

---

## Acknowledgments

- Edward de Bono: Six Thinking Hats framework
- Ollama: Cloud LLM infrastructure
- Vercel: Next.js framework
- shadcn: UI component library
- Tailwind Labs: CSS framework

---

**Happy Meeting Summarizing! 🚀**

Upload your transcripts, gain insights, and make your meetings more productive.
