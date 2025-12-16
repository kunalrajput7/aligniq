# Summar AI - Complete Project Documentation

> **Last Updated:** December 2024  
> **Version:** 1.0.0  
> **Tech Stack:** Next.js 14 + FastAPI + Supabase + Azure AI

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Tech Stack](#tech-stack)
4. [Backend Guide](#backend-guide)
5. [Frontend Guide](#frontend-guide)
6. [Database Schema](#database-schema)
7. [AI Pipeline](#ai-pipeline)
8. [API Reference](#api-reference)
9. [Environment Variables](#environment-variables)
10. [Deployment](#deployment)
11. [File Reference](#file-reference)

---

## Project Overview

**Summar AI** is a meeting transcript analyzer that processes VTT files and generates:
- Executive summaries with bullet points
- Action items with owners and deadlines
- Achievements and accomplishments
- Blockers and concerns
- Six Thinking Hats analysis per speaker
- Chapter breakdowns with summaries
- Interactive mindmaps
- Meeting timelines

### Key Features
- **Multi-model AI processing** using Azure AI (GPT-5 Nano, Mini)
- **Real-time status updates** via Supabase subscriptions
- **Project-based organization** for grouping related meetings
- **PDF export** with complete meeting data
- **Row-level security** (RLS) for data isolation

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vercel)                        │
│  Next.js 14 + TypeScript + Tailwind CSS + Framer Motion         │
├─────────────────────────────────────────────────────────────────┤
│  /dashboard       - Main dashboard with stats and activity      │
│  /dashboard/meetings     - List all standalone meetings         │
│  /dashboard/meetings/[id] - Meeting detail with MeetingDashboard│
│  /dashboard/projects     - List all projects                    │
│  /dashboard/projects/[id] - Project detail with meetings        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP (REST API)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND (Azure App Service)                │
│  FastAPI + Python 3.11 + HTTPX (async)                          │
├─────────────────────────────────────────────────────────────────┤
│  POST /summarize  - Upload VTT, run pipeline, save results      │
│  GET /health      - Health check with Azure AI status           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌─────────────────────────┐   ┌───────────────────────────────────┐
│      AZURE AI           │   │         SUPABASE                   │
│  (LLM Processing)       │   │  PostgreSQL + Auth + Realtime      │
├─────────────────────────┤   ├───────────────────────────────────┤
│  GPT-5 Nano (Stage 1)   │   │  profiles       - User accounts    │
│  GPT-5 Mini (Stage 2-3) │   │  projects       - Meeting groups   │
│  4 API calls/meeting    │   │  meetings       - Meeting metadata │
└─────────────────────────┘   │  meeting_summaries - Analysis JSON │
                              └───────────────────────────────────┘
```

---

## Tech Stack

### Backend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | **FastAPI** | Async REST API |
| Runtime | **Python 3.11** | Core language |
| HTTP Client | **HTTPX** | Async LLM calls |
| Database | **Supabase Python** | DB operations |
| Deployment | **Azure App Service** | Cloud hosting |

### Frontend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | **Next.js 14** | React SSR framework |
| Language | **TypeScript** | Type safety |
| Styling | **Tailwind CSS** | Utility-first CSS |
| Animations | **Framer Motion** | Smooth transitions |
| UI Library | **shadcn/ui** | Reusable components |
| Mindmap | **ReactFlow + ELK** | Interactive diagrams |
| PDF Export | **jsPDF** | Client-side PDF generation |
| Deployment | **Vercel** | Edge hosting |

### Cloud Services
| Service | Provider | Purpose |
|---------|----------|---------|
| LLM API | **Azure AI Foundry** | GPT-5 Nano/Mini models |
| Database | **Supabase** | PostgreSQL + Auth + Realtime |
| Backend Hosting | **Azure App Service** | Python API hosting |
| Frontend Hosting | **Vercel** | Next.js edge deployment |

---

## Backend Guide

### Directory Structure
```
backend/
├── main.py                 # FastAPI app entry point
├── pipeline.py             # Main pipeline orchestrator (4 stages)
├── models.py               # Pydantic response models
├── requirements.txt        # Python dependencies
├── Dockerfile              # Container configuration
├── startup.sh              # Azure startup script
├── supabase_schema.sql     # Database schema
├── stages/
│   ├── common.py           # Shared LLM call logic + retry
│   ├── stage1_foundation.py    # Metadata, timeline, chapters
│   ├── stage2_extraction.py    # Action items, achievements, blockers, hats
│   ├── stage3_synthesis.py     # Narrative summary, chapter summaries
│   └── stage4_mindmap.py       # Mindmap visualization
└── utils/
    ├── vtt_parser.py       # VTT file parser
    └── supabase_client.py  # Database CRUD operations
```

### Key Files Explained

#### `main.py`
- FastAPI application with CORS configuration
- Single endpoint: `POST /summarize`
- Accepts VTT file + optional user_id/project_id
- Delegates to `run_pipeline_async()`

#### `pipeline.py`
- **Main orchestrator** for the 4-stage pipeline
- Handles data normalization between stages
- Saves results to Supabase at the end
- Returns complete `PipelineResponse`

**Pipeline Flow:**
```
VTT File → Parse → Stage 1 → Stage 2 → Stage 3 → Stage 4 → Save to DB
                      ↓          ↓          ↓          ↓
                  Metadata   Extraction  Synthesis   Mindmap
```

#### `stages/common.py`
- `call_ollama_cloud_async()` - Unified Azure AI caller
- **Retry logic**: 3 attempts with exponential backoff
- **Timeout**: 600 seconds (10 minutes) base timeout
- Handles JSON mode for structured responses

#### `stages/stage1_foundation.py`
- **Model**: GPT-5 Nano (fast)
- **Extracts**: Meeting title, date, duration, participants
- **Generates**: Timeline (key moments), Chapter boundaries

#### `stages/stage2_extraction.py`
- **Model**: GPT-5 Mini (reasoning)
- **Extracts**: Action items (with priority), Achievements, Blockers (with severity)
- **Generates**: Six Thinking Hats analysis per speaker

#### `stages/stage3_synthesis.py`
- **Model**: GPT-5 Mini (creative)
- **Generates**: Executive summary with sections:
  - Executive Overview
  - Key Takeaways
  - Discussion Topics
  - Decisions & Agreements
  - Risks & Concerns
  - Next Steps
- **Generates**: Chapter summaries with context

#### `stages/stage4_mindmap.py`
- **No LLM** - Pure Python logic
- Builds visualization structure from Stage 1-3 data
- Creates nodes (root, chapters, claims) and edges

#### `utils/supabase_client.py`
- All database operations (CRUD)
- `save_meeting_results()` - Saves to meeting_summaries
- `update_meeting_status()` - Updates meeting status
- Project, meeting, and user operations

#### `utils/vtt_parser.py`
- Parses WebVTT transcript files
- Extracts: timestamps, speakers, text
- Calculates meeting duration

---

## Frontend Guide

### Directory Structure
```
frontend/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Landing page
│   ├── globals.css             # Global styles
│   ├── auth/callback/route.ts  # OAuth callback
│   ├── login/page.tsx          # Login page
│   └── dashboard/
│       ├── page.tsx            # Dashboard home
│       ├── meetings/
│       │   ├── page.tsx        # Meetings list
│       │   └── [id]/page.tsx   # Meeting detail
│       └── projects/
│           ├── page.tsx        # Projects list
│           └── [id]/page.tsx   # Project detail
├── components/
│   ├── MeetingDashboard.tsx    # Main meeting view component
│   ├── dashboard/
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── ActivityFeed.tsx    # Recent activity (past 3 days)
│   │   ├── StatsCards.tsx      # Dashboard statistics
│   │   ├── MindmapPreview.tsx  # Dashboard mindmap preview
│   │   ├── UploadModal.tsx     # File upload modal
│   │   └── UserDropdown.tsx    # User menu
│   ├── meeting_dashboard/
│   │   ├── MindmapCanvas.tsx   # Interactive mindmap with ReactFlow
│   │   ├── mindmap.css         # Mindmap styling
│   │   ├── SummaryPanel.tsx    # Narrative summary display
│   │   ├── ChaptersPanel.tsx   # Chapter list and details
│   │   ├── HatsAnalysisPanel.tsx  # Six Thinking Hats
│   │   └── ActionsPanel.tsx    # Action items display
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── supabase.ts             # Supabase client (browser)
│   ├── supabaseServer.ts       # Supabase client (server)
│   └── utils.ts                # Utility functions
├── types/
│   └── api.ts                  # TypeScript interfaces
└── middleware.ts               # Auth middleware
```

### Key Components

#### `MeetingDashboard.tsx`
- **Main container** for meeting analysis view
- Tabs: Overview | Chapters | Mindmap
- Renders sub-panels based on active tab
- Uses Framer Motion for smooth transitions

#### `MindmapCanvas.tsx`
- **ReactFlow** for interactive graph
- **ELK.js** for automatic layout
- Dynamic node sizing based on text length
- Smooth bezier edge connections
- Expand/collapse functionality
- Spring animations on nodes

#### `ActivityFeed.tsx`
- Fetches meetings from past 3 days
- Shows: title, participants, task count, mindmap status
- "View Summary" links to meeting detail

#### `UploadModal.tsx`
- Drag-and-drop VTT file upload
- Calls backend `/summarize` endpoint
- Shows loading state with messages

---

## Database Schema

### Tables

```sql
-- User profiles (synced with Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ
);

-- Projects (groups of related meetings)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meetings (standalone or project-based)
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  project_id UUID REFERENCES projects(id),  -- NULL for standalone
  title TEXT,
  date TIMESTAMPTZ,
  duration_ms INTEGER,
  participants TEXT[],
  status TEXT DEFAULT 'processing',  -- processing | completed | failed
  timeline_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meeting analysis results
CREATE TABLE meeting_summaries (
  meeting_id UUID PRIMARY KEY REFERENCES meetings(id),
  summary_json JSONB,    -- narrative_summary, action_items, achievements, blockers
  mindmap_json JSONB,    -- center_node, nodes, edges
  chapters_json JSONB,   -- array of chapter objects
  hats_json JSONB        -- Six Thinking Hats per speaker
);
```

### Row Level Security (RLS)
All tables have RLS enabled. Users can only:
- View/edit their own profiles
- View/insert/delete their own meetings
- View summaries for their own meetings

---

## AI Pipeline

### Stage Overview

| Stage | Model | Time | Purpose |
|-------|-------|------|---------|
| Stage 1 | GPT-5 Nano | ~30s | Extract metadata, timeline, chapters |
| Stage 2 | GPT-5 Mini | ~90s | Extract action items, hats analysis |
| Stage 3 | GPT-5 Mini | ~120s | Generate narrative summary |
| Stage 4 | None (Python) | <1s | Build mindmap structure |

**Total: ~4 minutes per meeting (4 API calls)**

### Evidence Format
All extracted items include evidence:
```json
{
  "speaker": "John Smith",
  "quote": "We need to finalize the design by Friday"
}
```

### Output Structure

```json
{
  "meeting_details": {
    "title": "Q4 Planning",
    "date": "2024-12-15",
    "duration_ms": 3600000,
    "participants": ["Alice", "Bob"]
  },
  "collective_summary": {
    "narrative_summary": "## Executive Overview\n...",
    "action_items": [{"task": "...", "owner": "...", "deadline": "...", "priority": "high"}],
    "achievements": [...],
    "blockers": [{"description": "...", "severity": "critical"}]
  },
  "chapters": [
    {"title": "...", "summary": "...", "start_ms": 0, "end_ms": 600000}
  ],
  "hats": [
    {"speaker": "Alice", "dominant_hats": [...]}
  ],
  "mindmap": {
    "center_node": {"id": "root", "label": "Q4 Planning"},
    "nodes": [...],
    "edges": [...]
  }
}
```

---

## API Reference

### `POST /summarize`

Upload a VTT file for processing.

**Request:**
```
Content-Type: multipart/form-data

file: <VTT file>
user_id: <optional UUID>
project_id: <optional UUID>
```

**Response:** `PipelineResponse` (see Output Structure above)

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "azure_ai_configured": true,
  "azure_ai_endpoint": "https://..."
}
```

---

## Environment Variables

### Backend (.env)
```bash
# Azure AI (Required)
AZURE_AI_ENDPOINT=https://your-endpoint.cognitiveservices.azure.com
AZURE_AI_KEY=your-api-key
AZURE_AI_DEPLOYMENT=gpt-5-nano

# Supabase (Required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key

# Optional: Stage-specific models
STAGE1_MODEL=gpt-5-nano
STAGE2_MODEL=gpt-5-mini
STAGE3_MODEL=gpt-5-mini
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## Deployment

### Backend (Azure App Service)
1. GitHub Actions deploys on push to `main` (if backend/ changed)
2. Uses `.github/workflows/azure-deploy.yml`
3. Requires secrets: `AZURE_WEBAPP_NAME`, `AZURE_WEBAPP_PUBLISH_PROFILE`

### Frontend (Vercel)
1. Auto-deploys on push to `main`
2. Requires environment variables in Vercel dashboard
3. No manual configuration needed

---

## File Reference

### Backend Files

| File | Lines | Purpose |
|------|-------|---------|
| `main.py` | 167 | FastAPI entry point, /summarize endpoint |
| `pipeline.py` | 778 | Pipeline orchestrator, data normalization |
| `models.py` | 120 | Pydantic response models |
| `stages/common.py` | 226 | Azure AI caller with retry logic |
| `stages/stage1_foundation.py` | 239 | Metadata extraction |
| `stages/stage2_extraction.py` | 240 | Deep extraction (items, hats) |
| `stages/stage3_synthesis.py` | 213 | Narrative synthesis |
| `stages/stage4_mindmap.py` | 180 | Mindmap builder |
| `utils/supabase_client.py` | 360 | Database CRUD |
| `utils/vtt_parser.py` | 100 | VTT file parser |

### Frontend Files

| File | Purpose |
|------|---------|
| `app/dashboard/page.tsx` | Dashboard with stats, activity feed |
| `app/dashboard/meetings/[id]/page.tsx` | Meeting detail + PDF export |
| `components/MeetingDashboard.tsx` | Main meeting view container |
| `components/meeting_dashboard/MindmapCanvas.tsx` | Interactive mindmap |
| `components/dashboard/ActivityFeed.tsx` | Recent activity (3 days) |
| `components/dashboard/Sidebar.tsx` | Navigation + upload button |
| `lib/supabase.ts` | Browser Supabase client |
| `types/api.ts` | TypeScript interfaces + HAT_DESCRIPTIONS |
| `middleware.ts` | Auth protection for /dashboard routes |

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Stage 3 timeout | Large meetings | Retry logic auto-handles (3 attempts) |
| Missing summary | Stage failed | Re-upload meeting after fix |
| Empty mindmap | No chapter summaries | Ensure Stage 3 completes |
| Vercel build fail | Missing env vars | Add SUPABASE env vars to Vercel |
| "Processing..." stuck | Pipeline error | Check backend logs |

---

## Development Commands

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

---

**For questions, check the backend logs or open an issue on GitHub.**
