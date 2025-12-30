# AlignIQ - Complete Project Documentation

> **Last Updated:** December 18, 2024  
> **Version:** 2.2.0  
> **Tech Stack:** Next.js 14 + FastAPI + Supabase + Azure AI (GPT-5-Mini)

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

**AlignIQ** ("Intelligence for alignment and cohesion") is a meeting transcript analyzer that processes VTT files and generates comprehensive meeting intelligence:

### Core Features
- **6-Section Executive Summaries** with structured markdown output
- **Action Items** with owners, deadlines, and priority levels
- **Achievements & Blockers** with severity ratings
- **Six Thinking Hats Analysis** per speaker
- **Meeting Tone Analysis** (collaborative/tense/productive)
- **Aligned vs Divergent Thinking** - where team agreed vs differed
- **Chapter Breakdowns** with topic-specific summaries
- **Interactive Mindmaps** with expand/collapse, auto-layout, and color-coded nodes
- **Real-time Notifications** via Supabase subscriptions (Toast alerts for success/failure)
- **Project Collaboration** - Invite members, shared workspaces, and team visibility
- **Activity Feed** with smart relative time ("Just now") and live updates
- **PDF Export** with complete meeting data including mindmap structure

### The 6-Section Summary Format
```markdown
**1. Executive Overview**    - 3-4 sentence purpose & outcomes
**2. Key Takeaways**         - 4-6 most important points
**3. Discussion Topics**     - Major topics with sub-sections per chapter
**4. Meeting Tone**          - Atmosphere & energy analysis
**5. Aligned Thinking**      - Points of consensus
**6. Divergent Perspectives** - Areas of disagreement
```

> **Note:** Action Items, Achievements, and Blockers are displayed in separate UI panels, not in the narrative summary.

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
                            │ HTTP (REST API) + Supabase Realtime (Channels: meetings, project_collaborators)
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
│  GPT-5 Mini (All Stages)│   │  profiles       - User accounts    │
│  Token logging enabled  │   │  projects       - Meeting groups   │
│  Reasoning + Output     │   │  meetings       - Meeting metadata │
│  breakdown tracked      │   │  meeting_summaries - Analysis JSON │
│                         │   │  project_collaborators - Sharing   │
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
│   ├── common.py           # Shared LLM call logic + retry + token logging
│   ├── stage1_foundation.py    # Metadata, timeline, chapters + COMPREHENSIVE SUMMARIES
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
- **Token logging**: Tracks prompt, completion, reasoning, and output tokens
- Handles JSON mode for structured responses
- Uses correct deployment name from stage-specific model settings

#### `stages/stage1_foundation.py`
- **Model**: GPT-5 Mini (reasoning, ~60-90s)
- **Input**: Raw utterances (full transcript)
- **Extracts**: Meeting title, date, duration, participants
- **Generates**: Timeline (key moments), Chapters with:
  - Title, timestamps, topic keywords
  - **COMPREHENSIVE SUMMARIES** (no length limit, covers all important content)

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

#### `stages/stage3_synthesis.py` (OPTIMIZED)
- **Model**: GPT-5 Mini (~30-45s)
- **Input**: STRUCTURED DATA ONLY (no transcript!)
  - Chapters with summaries (from Stage 1)
  - Tone, convergent_points, divergent_points (from Stage 2)
  - Action items, achievements, blockers (for context)
- **Token efficiency**: ~2K input tokens (vs ~25K if transcript was included)
- **Generates**: 6-section narrative summary
- **Post-processing**: `_sanitize_narrative_summary()` cleans LLM output

**6 Mandatory Sections:**
1. Executive Overview
2. Key Takeaways
3. Discussion Topics (with ## sub-topics per chapter)
4. Meeting Tone
5. Aligned Thinking
6. Divergent Perspectives

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
│   │   ├── Sidebar.tsx         # Navigation sidebar (AlignIQ branding)
│   │   ├── ActivityFeed.tsx    # Recent activity (past 3 days) with real-time updates
│   │   ├── StatsCards.tsx      # Dashboard statistics with count-up animation
│   │   ├── MindmapPreview.tsx  # Dashboard mindmap preview
│   │   ├── MeetingChains.tsx   # Quick Tips carousel with animations
│   │   ├── UploadModal.tsx     # File upload with preselectedProjectId support
│   │   ├── InviteMembersModal.tsx  # Invite collaborators to projects
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
- Uses `prose` typography for clean markdown rendering
- **Real-time Status**: Listens for 'completed' status to auto-refresh data

#### `ProcessingNotifications.tsx` (NEW)
- **Supabase real-time subscriptions** for meeting status updates
- **Channel**: `postgres_changes` on `meetings` table (filter: `user_id=eq.current_user`)
- Toast notifications when meetings complete/fail
- Green/Red gradient styling with spring animations
- Auto-dismiss after 10 seconds (or manual dismiss)
- Links directly to the completed meeting detail page

#### `dashboard/layout.tsx` (NEW)
- Wraps all `/dashboard/*` routes
- Includes `<ProcessingNotifications />` globally
- Ensures notifications appear on any dashboard page regardless of current view

#### `lib/api.ts` - Upload Handling
- **30-second timeout** with AbortController
- **Graceful timeout handling**: If request times out, assumes success (backend continues processing)
- Returns `{ success: boolean, message: string }` immediately
- Frontend uses Supabase real-time to track actual completion

#### `UploadModal.tsx`
- Drag-and-drop VTT file upload
- **Smart Context**: Automatically selects current project if uploaded from Project Detail page
- **Skip Logic**: Skips "Select Project" step if project_id is pre-filled
- Immediate transition to "complete" step after upload
- Message: "Your meeting is being processed. Check the Meetings section to see when it's ready."

#### `MindmapCanvas.tsx`
- **ReactFlow** for interactive graph
- **ELK.js** for automatic layered layout (Direction: RIGHT)
- **Dynamic Sizing**: Calculates node width/height based on text length
- **Animations**: Framer Motion spring animations on node appearance
- **Palette**: Color-coded by node type (Root: Indigo, Chapter: Gray, Action: Blue, Blocker: Red)

#### `ActivityFeed.tsx`
- Fetches meetings from **past 3 days**
- **Smart Time**: "Just now", "5m ago", "Today at 2:00 PM", "Yesterday"
- **Live Updates**: Real-time subscription to `meetings` and `project_collaborators`
- **Collaboration Events**: Shows "Invited to Project X" and "Shared Project Y"
- **Visuals**: Distinct icons for Video (Meeting) vs Share (Collaboration)

#### `projects/page.tsx` & Note Cards
- **Project Cards**: Grid view with status badges (In Progress/Active)
- **Collaboration Badge**: "Shared" badge if multiple members exist
- **Summer AI Insight**: Yellow note block showing meeting count impact
- **Sorting**: Most recent activity first (based on latest meeting or creation)


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
| **Efficiency** | Stage 3 uses only ~2K input tokens (no transcript) |
| **Detailed Chapters** | Stage 1 writes comprehensive summaries with full transcript access |
| **Reliability** | Retry logic handles transient failures |
| **Quality** | Smaller, focused prompts = better LLM output |
| **Token Logging** | Tracks prompt, completion, reasoning, and output tokens |

### Timing Expectations

| Stage | Model | Approx Time | Input Tokens |
|-------|-------|-------------|--------------|
| Stage 1 | GPT-5 Mini | ~60-90s | ~25K (transcript) |
| Stage 2 | GPT-5 Mini | ~90-120s | ~25K (transcript) |
| Stage 3 | GPT-5 Mini | ~30-45s | ~2K (structured only) |
| Stage 4 | Python | <1s | - |
| **Total** | - | **~3-4 minutes** | **~52K** |

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
AZURE_AI_API_VERSION=2024-05-01-preview

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
- `AZURE_AI_ENDPOINT`
- `AZURE_AI_KEY`
- `AZURE_AI_DEPLOYMENT`
- `AZURE_AI_API_VERSION` (Optional, defaults to 2024-05-01-preview)
- `SUPABASE_URL`
- `SUPABASE_KEY`

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
| 500 Error on Upload | Azure AI Config | Check `AZURE_AI_KEY` and `AZURE_AI_ENDPOINT` in App Service |
| Deployment Fails | GitHub Secrets | Verify `AZURE_WEBAPP_PUBLISH_PROFILE` is the exact XML content |

### Cost Estimates
- **Azure App Service**: ~$13/mo (B1) or ~$55/mo (S1)
- **Azure AI Foundry**: Pay-per-use (~$0.50 - $2.00 per meeting)
- **Vercel**: Free (Hobby) or $20/mo (Pro)
- **Supabase**: Free tier available (sufficient for dev)

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

## Recent Changes (v2.2.0)

### Project Collaboration
1. **Invite Members** - Share projects with other users via email/username search
2. **Shared Badge** - Projects show "Shared" badge when collaborators exist
3. **Team Members Panel** - Project detail page shows owner + all collaborators
4. **RLS Policies** - Collaborators can view shared projects and their meetings

### Real-time Updates
5. **Dashboard Stats Animation** - Numbers count up from 0 with spring animation
6. **Live Stats Refresh** - StatsCards update in real-time when projects/meetings change
7. **Activity Feed Live** - Updates instantly when meetings processed or shared
8. **Collaborator Updates** - Team members panel updates when invites complete

### Streamlined Upload Flow
9. **Direct Project Upload** - Click "Upload Meeting" in project → file picker opens directly
10. **Skip Selection Steps** - No more "choose type" or "select project" when in project context
11. **Direct Invite** - "Invite Members" from project page skips project selection

### Dashboard UI Enhancements
12. **Quick Tips Carousel** - Animated tips replace Meeting Chains (auto-rotate every 8s)
13. **Project Cards** - Show Meetings count, Status (Shared/Private), Members count
14. **Aligned Layout** - Activity Feed and Mindmap boxes have matching heights
15. **Responsive Scrolling** - Activity feed uses flex-1 for responsive height

### Authentication
16. **Removed OAuth** - Google/GitHub sign-in buttons removed (email only)

### Database Migrations
- **008_collaboration_feature.sql** - Creates `project_collaborators` table with RLS
- **009_fix_rls_policies.sql** - Fixes infinite recursion in collaboration RLS policies

### Previous (v2.1.0)
- Stage 1 Chapter Summaries with full transcript access
- Stage 3 Optimized (structured data only, ~2K tokens)
- GPT-5-Mini unified across all stages
- Sanitization fix for narrative truncation
- 6-Section enforcement with "DO NOT SKIP" markers

### Previous (v2.0.0)
- Stage 2 Enhanced with tone, convergent_points, divergent_points
- Real-time notifications via Supabase
- Frontend 30s timeout with graceful handling

---

**For questions, check the backend logs or open an issue on GitHub.**
