# AlignIQ - Intelligent Meeting Analysis Platform

**"Intelligence for alignment and cohesion."**

AlignIQ is an advanced AI-powered meeting intelligence platform that transforms raw Microsoft Teams transcripts (`.vtt`) into deep, actionable insights. By leveraging a sophisticated multi-stage AI pipeline, AlignIQ goes beyond simple summaries to provide executive-level analysis, strategic alignment detection, and interactive visualizations.

---

## 🏗️ System Architecture

### High-Level Architecture
A complete overview of the AlignIQ stack, from the Next.js frontend to the FastAPI backend and Azure AI integration.

![AlignIQ System Diagram](/frontend/public/AlignIQ_System_Diagram.png)

### Live Performance & Data Flow
A detailed look at how data flows through the 4-stage AI pipeline, including real-time processing and latency metrics.

![AlignIQ Informative System Diagram](/frontend/public/AlignIQ_Informative_System_Diagram.png)

---

## 🚀 Key Features

### 🧠 Deep Agential Analysis
- **6-Section Executive Summaries**: Structured narrative covering key takeaways, decisions, and discussions.
- **Six Thinking Hats Analysis**: Applies Edward de Bono's framework to analyze each participant's cognitive style (Blue/Facilitator, Red/Emotional, etc.).
- **Alignment & Divergence Engine**: Automatically detects where the team agrees and where strategic friction exists.
- **Tone Analysis**: Measures the emotional temperature and collaboration level of the meeting.

### ⚡ Real-Time Intelligence
- **Live Activity Feed**: Updates instantly as meetings are processed or shared.
- **Smart Notifications**: Real-time Supabase subscriptions deliver toast alerts when analysis matches complete.
- **Dynamic Stats**: Animated dashboard metrics tracking your team's meeting efficiency.

### 🛠️ Collaboration & Management
- **Project Workspaces**: Organize meetings into projects and invite team members.
- **Role-Based Access**: Granular permissions for viewing and collaborating on shared projects.
- **Action Item Tracking**: Auto-extracted tasks with owners, deadlines, and priority levels.

### 🎨 Value-Driven Visualizations
- **Interactive Mindmaps**: ReactFlow-powered diagrams to visualize the "forest and the trees" of complex discussions.
- **Rich Markdown Reports**: Beautifully formatted reports using `prose` typography for high readability.
- **PDF Export**: One-click export of the entire analysis, including mindmap structure, for offline sharing.

---

## 💻 Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Next.js 14, TypeScript, Tailwind, Framer Motion | Modern, responsive UI with smooth animations |
| **Backend** | FastAPI, Python 3.11, AsyncIO | High-performance async orchestration |
| **Database** | Supabase (PostgreSQL) | Real-time data sync & robust storage |
| **AI Engine** | Azure AI Foundry (GPT-5 Mini) | Cognitive processing & reasoning |
| **Visualization** | ReactFlow, ELK.js | Auto-layout graphs & diagrams |

---

## 🏁 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Azure AI Credentials
- Supabase Project

### 1. Setup Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # or .\.venv\Scripts\activate on Windows
pip install -r requirements.txt

# Configure .env
cp .env.example .env
# Add AZURE_AI_KEY, AZURE_AI_ENDPOINT, SUPABASE_URL, SUPABASE_KEY
```

### 2. Setup Frontend
```bash
cd frontend
npm install

# Configure .env.local
cp .env.local.example .env.local
# Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Run the Platform
```bash
# Terminal 1: Backend
cd backend
uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

Visit `http://localhost:3000` to start analyzing meetings!

---

## 🔒 Security
This project follows strict security best practices:
- **Environment Variables**: All sensitive keys are strictly managed via `.env` files and never committed.
- **Row Level Security (RLS)**: Database policies ensure users catch only access data they own or have been explicitly granted.
- **Secure API**: Backend endpoints are protected and validated.

---

*(c) 2025 AlignIQ Team. All rights reserved.*
