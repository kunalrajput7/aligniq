# Summar AI - Complete Project Documentation

> **Last Updated:** December 16, 2024  
> **Version:** 2.0.0  
> **Tech Stack:** Next.js 14 + FastAPI + Supabase + Azure AI

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Tech Stack](#tech-stack)
4. [Backend Guide](#backend-guide)
5. [Frontend Guide](#frontend-guide)
6. [Database Schema](#database-schema)
7. [AI Pipeline Deep Dive](#ai-pipeline-deep-dive)
8. [API Reference](#api-reference)
9. [Environment Variables](#environment-variables)
10. [Deployment](#deployment)
11. [File Reference](#file-reference)
12. [Common Issues & Solutions](#common-issues--solutions)

---

## Project Overview

**Summar AI** is a meeting transcript analyzer that processes VTT files and generates comprehensive meeting intelligence:

### Core Features
- **8-Section Executive Summaries** with structured markdown output
- **Action Items** with owners, deadlines, and priority levels
- **Achievements & Blockers** with severity ratings
- **Six Thinking Hats Analysis** per speaker
- **Meeting Tone Analysis** (collaborative/tense/productive)
- **Aligned vs Divergent Thinking** - where team agreed vs differed
- **Chapter Breakdowns** with topic-specific summaries
- **Interactive Mindmaps** with expand/collapse
- **Real-time Notifications** when processing completes
- **PDF Export** with complete meeting data

### The 8-Section Summary Format
```markdown
**1. Executive Overview**    - 3-4 sentence purpose & outcomes
**2. Key Takeaways**         - 4-6 most important points
**3. Discussion Topics**     - Major topics with sub-sections
**4. Meeting Tone**          - Atmosphere & energy analysis
**5. Aligned Thinking**      - Points of consensus
**6. Divergent Perspectives** - Areas of disagreement
**7. Decisions Made**        - All decisions with owners
**8. Action Items**          - Tasks with owner/deadline/priority
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vercel)                            │
│  Next.js 14 + TypeScript + Tailwind CSS + Framer Motion             │
├─────────────────────────────────────────────────────────────────────┤
│  /dashboard              - Stats, activity feed, mindmap preview    │
│  /dashboard/meetings     - List all meetings with search            │
│  /dashboard/meetings/[id] - Meeting detail with MeetingDashboard    │
│  /dashboard/projects     - Project management                       │
│  /dashboard/projects/[id] - Project detail with meetings            │
│                                                                      │
│  ProcessingNotifications - Real-time toast when meetings complete   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP (REST API) + Supabase Realtime
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       BACKEND (Azure App Service)                    │
│  FastAPI + Python 3.11 + HTTPX (async)                              │
├─────────────────────────────────────────────────────────────────────┤
│  POST /summarize  - Upload VTT, run 4-stage pipeline, save to DB    │
│  GET /health      - Health check with Azure AI status               │
│                                                                      │
│  Pipeline: Stage 1 → Stage 2 → Stage 3 → Stage 4                    │
│            (Foundation) (Extraction) (Synthesis) (Mindmap)          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌─────────────────────────┐   ┌───────────────────────────────────┐
│      AZURE AI           │   │         SUPABASE                   │
│  (LLM Processing)       │   │  PostgreSQL + Auth + Realtime      │
├─────────────────────────┤   ├───────────────────────────────────┤
│  GPT-5 Nano (Stage 1)   │   │  profiles       - User accounts    │
│  GPT-5 Mini (Stage 2)   │   │  projects       - Meeting groups   │
│  GPT-5 Mini (Stage 3)   │   │  meetings       - Meeting metadata │
│  max_tokens: 16000      │   │  meeting_summaries - Analysis JSON │
└─────────────────────────┘   └───────────────────────────────────┘
```

---

## Tech Stack

### Backend
| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | **FastAPI** | Async REST API |
| Runtime | **Python 3.11** | Core language |
| HTTP Client | **HTTPX** | Async LLM calls with retry |
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
| Realtime | **Supabase Subscriptions** | Live status updates |
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
├── main.py                 # FastAPI entry point, CORS config
├── pipeline.py             # Main pipeline orchestrator (4 stages)
├── models.py               # Pydantic response models
├── requirements.txt        # Python dependencies
├── Dockerfile              # Container configuration
├── startup.sh              # Azure startup script
├── supabase_schema.sql     # Database schema
├── stages/
│   ├── common.py           # Shared LLM call logic + retry (3 attempts)
│   ├── stage1_foundation.py    # Metadata, timeline, chapters
│   ├── stage2_extraction.py    # Action items, achievements, blockers, hats, tone, convergent/divergent
│   ├── stage3_synthesis.py     # 8-section narrative summary with post-processing
│   └── stage4_mindmap.py       # Mindmap visualization
└── utils/
    ├── vtt_parser.py       # VTT file parser
    └── supabase_client.py  # Database CRUD operations
```

### Key Files Explained

#### `main.py`
- FastAPI application with CORS configuration
- Allowed origins: `localhost:3000`, Vercel production URL
- Single endpoint: `POST /summarize`
- Accepts VTT file + optional user_id/project_id
- Delegates to `run_pipeline_async()`

#### `pipeline.py`
- **Main orchestrator** for the 4-stage pipeline
- Handles data normalization between stages
- **Passes extracted data forward**: tone, convergent_points, divergent_points flow from Stage 2 → Stage 3
- Saves results to Supabase at the end
- Returns complete `PipelineResponse`

**Data Flow:**
```
VTT File → Parse → Stage 1 → Stage 2 → Stage 3 → Stage 4 → Save to DB
                      ↓          ↓          ↓          ↓
                  Metadata   Extraction  Synthesis   Mindmap
                  Chapters   Tone         8-Section   Nodes
                  Timeline   Convergent   Summary     Edges
                             Divergent    Chapters
                             Hats
```

#### `stages/common.py`
- `call_ollama_cloud_async()` - Unified Azure AI caller
- **Retry logic**: 3 attempts with exponential backoff (5s, 10s, 20s)
- **Timeout**: 600 seconds (10 minutes) base timeout, increases per retry
- **max_tokens**: Stage 3 uses 16000 to prevent truncation
- Handles JSON mode for structured responses

#### `stages/stage1_foundation.py`
- **Model**: GPT-5 Nano (fast, ~30s)
- **Input**: Raw utterances
- **Extracts**: Meeting title, date, duration, participants
- **Generates**: Timeline (key moments), Chapter boundaries with topic keywords

#### `stages/stage2_extraction.py` (404 lines)
- **Model**: GPT-5 Mini (reasoning, ~90s)
- **Input**: Utterances + Chapters from Stage 1
- **Extracts**:
  - Action items (task, owner, deadline, priority, evidence)
  - Achievements (completed work with evidence)
  - Blockers (issues with severity: critical/major/minor)
  - Six Thinking Hats (dominant hat per speaker)
  - **Tone Analysis** (overall, energy, description)
  - **Convergent Points** (where team agreed)
  - **Divergent Points** (where opinions differed + resolution)

**New Stage 2 Output Structure:**
```json
{
  "action_items": [...],
  "achievements": [...],
  "blockers": [...],
  "six_thinking_hats": {...},
  "tone": {
    "overall": "collaborative",
    "energy": "high",
    "description": "The meeting started formal but became more collaborative..."
  },
  "convergent_points": [
    {"topic": "Q1 timeline is achievable", "agreed_by": ["Alice", "Bob"], "evidence": {...}}
  ],
  "divergent_points": [
    {"topic": "Feature priority", "perspectives": [...], "resolution": "Parallel tracks"}
  ]
}
```

#### `stages/stage3_synthesis.py` (385 lines)
- **Model**: GPT-5 Mini (creative, ~120s)
- **Input**: Utterances, Chapters, Action Items, Achievements, Blockers, Hats, Tone, Convergent, Divergent
- **max_tokens**: 16000 (prevents truncation)
- **Generates**: 8-section narrative summary in markdown
- **Post-processing**: `_fix_markdown_headers()` normalizes all section headers to consistent `**bold**` format

**8 Mandatory Sections:**
1. Executive Overview
2. Key Takeaways
3. Discussion Topics (with ## sub-topics)
4. Meeting Tone
5. Aligned Thinking
6. Divergent Perspectives
7. Decisions Made
8. Action Items

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
│       ├── layout.tsx          # Dashboard layout with ProcessingNotifications
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
│   │   ├── Sidebar.tsx         # Navigation sidebar (Summar AI branding)
│   │   ├── ActivityFeed.tsx    # Recent activity (past 3 days)
│   │   ├── StatsCards.tsx      # Dashboard statistics
│   │   ├── MindmapPreview.tsx  # Dashboard mindmap preview
│   │   ├── UploadModal.tsx     # File upload modal with progress
│   │   ├── ProcessingNotifications.tsx  # Real-time toast notifications
│   │   ├── UserDropdown.tsx    # User menu
│   │   └── WelcomeBanner.tsx   # Welcome message
│   ├── meeting_dashboard/
│   │   ├── MindmapCanvas.tsx   # Interactive mindmap with ReactFlow
│   │   ├── mindmap.css         # Mindmap styling
│   │   ├── ChaptersList.tsx    # Chapter list and details
│   │   ├── HatSystem.tsx       # Six Thinking Hats visualization
│   │   ├── AchievementsList.tsx # Achievements display
│   │   ├── BlockersList.tsx    # Blockers display
│   │   └── DeadlinesList.tsx   # Deadlines display
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── supabase.ts             # Supabase client (browser)
│   ├── supabaseServer.ts       # Supabase client (server)
│   ├── api.ts                  # Backend API client with timeout handling
│   └── utils.ts                # Utility functions
├── types/
│   └── api.ts                  # TypeScript interfaces
└── middleware.ts               # Auth middleware
```

### Key Components

#### `MeetingDashboard.tsx`
- **Main container** for meeting analysis view
- Tabs: Overview | Chapters | Mindmap
- Renders narrative summary using ReactMarkdown with remark-gfm
- Prose typography for clean markdown rendering

#### `ProcessingNotifications.tsx` (NEW)
- **Supabase real-time subscriptions** for meeting status updates
- Toast notifications when meetings complete/fail
- Green toast for completed, red for failed
- Auto-dismiss after 10 seconds with progress bar
- Framer Motion animations
- Links to view completed meetings

#### `dashboard/layout.tsx` (NEW)
- Wraps all `/dashboard/*` routes
- Includes `<ProcessingNotifications />` globally
- Ensures notifications appear on any dashboard page

#### `lib/api.ts` - Upload Handling
- **30-second timeout** with AbortController
- **Graceful timeout handling**: If request times out, assumes success (backend continues processing)
- Returns `{ success: boolean, message: string }` immediately
- Frontend uses Supabase real-time to track actual completion

#### `UploadModal.tsx`
- Drag-and-drop VTT file upload
- Project selection dropdown
- Immediate transition to "complete" step after upload
- Message: "Your meeting is being processed. Check the Meetings section to see when it's ready."

#### `MindmapCanvas.tsx`
- **ReactFlow** for interactive graph
- **ELK.js** for automatic layout
- Dynamic node sizing based on text length
- Expand/collapse functionality
- Spring animations on nodes

#### `ActivityFeed.tsx`
- Fetches meetings from **past 3 days**
- Shows: title, participants, task count, mindmap status
- Full date/time display (not relative)

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

-- Meeting analysis results (JSONB columns for flexibility)
CREATE TABLE meeting_summaries (
  meeting_id UUID PRIMARY KEY REFERENCES meetings(id),
  summary_json JSONB,    -- narrative_summary, action_items, achievements, blockers
  mindmap_json JSONB,    -- center_node, nodes, edges
  chapters_json JSONB,   -- array of chapter objects
  hats_json JSONB        -- Six Thinking Hats per speaker
);
```

### JSONB Flexibility
The `summary_json` column uses JSONB, allowing new fields (like tone, convergent_points, divergent_points) to be added **without schema migrations**.

### Row Level Security (RLS)
All tables have RLS enabled. Users can only:
- View/edit their own profiles
- View/insert/delete their own meetings
- View summaries for their own meetings

---

## AI Pipeline Deep Dive

### Stage Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       STAGE 1: FOUNDATION                        │
│  GPT-5 Nano (~30s) - Fast metadata extraction                   │
├─────────────────────────────────────────────────────────────────┤
│  INPUT:  Raw utterances from VTT                                │
│  OUTPUT: meeting_details, timeline, chapters                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ chapters passed down
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       STAGE 2: EXTRACTION                        │
│  GPT-5 Mini (~90s) - Deep reasoning extraction                  │
├─────────────────────────────────────────────────────────────────┤
│  INPUT:  Utterances + Chapters                                  │
│  OUTPUT:                                                        │
│   • action_items      (task, owner, deadline, priority)         │
│   • achievements      (what was completed)                      │
│   • blockers          (issues with severity)                    │
│   • six_thinking_hats (dominant hat per speaker)                │
│   • tone              (overall, energy, description) ← NEW      │
│   • convergent_points (where team agreed) ← NEW                 │
│   • divergent_points  (disagreements + resolution) ← NEW        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ ALL outputs passed down
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       STAGE 3: SYNTHESIS                         │
│  GPT-5 Mini (~120s) - Creative narrative generation             │
│  max_tokens: 16000                                              │
├─────────────────────────────────────────────────────────────────┤
│  INPUT:  Utterances + Chapters + Action Items + Achievements    │
│          + Blockers + Hats + Tone + Convergent + Divergent      │
│                                                                  │
│  OUTPUT: 8-Section Narrative Summary + Chapter Summaries        │
│                                                                  │
│  POST-PROCESSING: _fix_markdown_headers() normalizes all        │
│                   section headers to consistent **bold** format │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       STAGE 4: MINDMAP                           │
│  Pure Python (~1s) - No LLM needed                              │
├─────────────────────────────────────────────────────────────────┤
│  INPUT:  All outputs from Stages 1-3                            │
│  OUTPUT: nodes[], edges[] for ReactFlow visualization           │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Architecture?

| Benefit | Explanation |
|---------|-------------|
| **Accuracy** | Stage 3 uses extracted facts from Stage 2, not hallucinating |
| **Consistency** | Action items in summary match extracted items exactly |
| **Efficiency** | Each stage uses the right model (fast vs reasoning) |
| **Reliability** | Retry logic handles transient failures |
| **Quality** | Smaller, focused prompts = better LLM output |
| **No Truncation** | 16000 max_tokens ensures complete 8-section output |

### Timing Expectations

| Stage | Model | Approx Time |
|-------|-------|-------------|
| Stage 1 | GPT-5 Nano | ~30s |
| Stage 2 | GPT-5 Mini | ~90s |
| Stage 3 | GPT-5 Mini | ~120s |
| Stage 4 | Python | <1s |
| **Total** | - | **~4 minutes** |

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

**Response:** Backend processes asynchronously. Frontend should:
1. Get immediate acknowledgment (or timeout after 30s)
2. Use Supabase real-time to track `meetings.status` changes
3. Display notification when status → `completed` or `failed`

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

# Supabase (Required) - MUST be set in Azure App Service
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key  # Use service_role key, not anon

# Optional: Stage-specific models
STAGE1_MODEL=gpt-5-nano
STAGE1_ENDPOINT=https://...
STAGE1_KEY=...

STAGE2_MODEL=gpt-5-mini
STAGE2_ENDPOINT=https://...
STAGE2_KEY=...

STAGE3_MODEL=gpt-5-mini
STAGE3_ENDPOINT=https://...
STAGE3_KEY=...
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000  # Or Azure backend URL
```

### Azure App Service Configuration
These must be set in Azure Portal → App Service → Configuration:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `AZURE_AI_ENDPOINT`
- `AZURE_AI_KEY`
- `AZURE_AI_DEPLOYMENT`

---

## Deployment

### Backend (Azure App Service)
1. GitHub Actions deploys on push to `main` (if backend/ changed)
2. Uses `.github/workflows/azure-deploy.yml`
3. Requires secrets: `AZURE_WEBAPP_NAME`, `AZURE_WEBAPP_PUBLISH_PROFILE`
4. **Critical**: Set all environment variables in Azure App Service Configuration
5. Enable "Always On" to prevent cold starts

### Frontend (Vercel)
1. Auto-deploys on push to `main`
2. Requires environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` (Azure backend URL)
3. No manual configuration needed

### CORS Configuration
Backend `main.py` must include Vercel production URL in allowed origins:
```python
allowed_origins = [
    "http://localhost:3000",
    "https://your-app.vercel.app",
]
```

---

## File Reference

### Backend Files

| File | Lines | Purpose |
|------|-------|---------|
| `main.py` | ~170 | FastAPI entry point, /summarize endpoint, CORS |
| `pipeline.py` | ~780 | Pipeline orchestrator, data normalization, DB save |
| `models.py` | ~120 | Pydantic response models |
| `stages/common.py` | ~230 | Azure AI caller with retry (3 attempts, 600s timeout) |
| `stages/stage1_foundation.py` | ~240 | Metadata, timeline, chapter extraction |
| `stages/stage2_extraction.py` | **~404** | Deep extraction + tone + convergent/divergent |
| `stages/stage3_synthesis.py` | **~385** | 8-section narrative + post-processing |
| `stages/stage4_mindmap.py` | ~180 | Mindmap builder (no LLM) |
| `utils/supabase_client.py` | ~360 | Database CRUD operations |
| `utils/vtt_parser.py` | ~100 | VTT file parser |

### Frontend Files

| File | Purpose |
|------|---------|
| `app/dashboard/layout.tsx` | Dashboard layout with ProcessingNotifications |
| `app/dashboard/page.tsx` | Dashboard with stats, activity feed |
| `app/dashboard/meetings/[id]/page.tsx` | Meeting detail + PDF export |
| `components/MeetingDashboard.tsx` | Main meeting view container |
| `components/meeting_dashboard/MindmapCanvas.tsx` | Interactive mindmap |
| `components/dashboard/ProcessingNotifications.tsx` | Real-time toast notifications |
| `components/dashboard/ActivityFeed.tsx` | Recent activity (3 days) |
| `components/dashboard/Sidebar.tsx` | Navigation + Summar AI branding |
| `components/dashboard/UploadModal.tsx` | File upload with timeout handling |
| `lib/api.ts` | Backend API client (30s timeout, graceful handling) |
| `lib/supabase.ts` | Browser Supabase client |
| `types/api.ts` | TypeScript interfaces + HAT_DESCRIPTIONS |
| `middleware.ts` | Auth protection for /dashboard routes |

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Failed to fetch" on upload | Browser timeout | Fixed: Frontend uses 30s timeout + assumes success |
| Section 8 cut off | Token limit | Fixed: Stage 3 uses max_tokens=16000 |
| Inconsistent bold headers | LLM formatting | Fixed: Post-processing normalizes headers |
| Missing Tone/Aligned/Divergent sections | Old prompt | Fixed: Prompt explicitly requires all 8 sections |
| Backend not saving to Supabase | Missing env vars | Add SUPABASE_URL and SUPABASE_KEY to Azure |
| CORS errors | Missing origin | Add Vercel URL to allowed_origins in main.py |
| Stage 3 timeout | Large meetings | Retry logic handles (3 attempts with backoff) |
| "Processing..." stuck | Pipeline error | Check backend logs for stage failures |
| No real-time notifications | Missing layout | Ensure dashboard/layout.tsx includes ProcessingNotifications |

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

## Recent Changes (v2.0.0)

1. **Stage 2 Enhanced** - Added tone, convergent_points, divergent_points extraction
2. **Stage 3 Rewritten** - 8-section narrative format with strict enforcement
3. **Post-processing Added** - `_fix_markdown_headers()` normalizes formatting
4. **max_tokens=16000** - Prevents truncation of Section 8
5. **Frontend Timeout Handling** - 30s timeout with graceful fallback
6. **Real-time Notifications** - Toast when meetings complete/fail
7. **Dashboard Layout** - Global notification component

---

**For questions, check the backend logs or open an issue on GitHub.**
