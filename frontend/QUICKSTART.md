# Frontend Quick Start Guide

## Installation (5 minutes)

### 1. Open Terminal

```bash
cd c:\Users\kunal\Desktop\Projects\llm_meet_summarizer\frontend
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- Next.js 14
- TypeScript
- Tailwind CSS
- shadcn/ui components
- React Flow (for diagrams)
- All other dependencies

### 3. Start Development Server

```bash
npm run dev
```

### 4. Open Browser

Navigate to: **http://localhost:3000**

## First Use

### Step 1: Ensure Backend is Running

Before using the frontend, make sure your backend is running:

```bash
# In another terminal
cd c:\Users\kunal\Desktop\Projects\llm_meet_summarizer\backend
python main.py
```

Backend should be at: **http://localhost:8000**

### Step 2: Upload Transcript

1. On the homepage, you'll see a drag-and-drop upload area
2. Click or drag your `.vtt` file
3. Click "Analyze Meeting"
4. Wait for processing (2-10 minutes depending on length)

### Step 3: Explore Dashboard

Once complete, you'll see 5 tabs:

1. **Overview** - Summary, mentions, achievements, blockers
2. **Chapters** - Meeting chapters and topics
3. **Tasks & Items** - All tasks and activities
4. **People** - Hat analysis and insights
5. **Decisions** - Decision flow and list

## What You'll See

### Overview Tab
- Meeting title, date, duration, participants
- Timeline bar with chapter markers
- Meeting summary
- Mentions counter (who spoke about what)
- Top achievements
- Top blockers
- Upcoming deadlines

### Chapters Tab
- All meeting chapters
- Chapter titles and summaries
- Segment IDs for each chapter

### Tasks & Items Tab
- Self-assigned tasks
- Tasks assigned to others
- Who did what activities
- All with owners, deadlines, and status

### People Tab
- Six Thinking Hats analysis per person
- Color-coded hat types
- Evidence for each hat
- Achievements per member
- Blockers per member

### Decisions Tab
- Decision flow diagram (visual tree)
- Complete decision list
- Decision makers
- Impact statements
- Evidence with timestamps

## Key Features

### 1. Meeting Header
- Shows title, date, duration
- Lists all participants
- Highlights unknown speakers

### 2. Timeline Bar
- Visual duration bar
- Chapter markers
- Key timeline points with timestamps

### 3. Six Thinking Hats
- **White Hat** (Gray) - Facts & Data
- **Red Hat** (Red) - Emotions & Feelings
- **Black Hat** (Dark) - Critical Thinking
- **Yellow Hat** (Yellow) - Optimism & Benefits
- **Green Hat** (Green) - Creativity & Ideas
- **Blue Hat** (Blue) - Process & Organization

### 4. Mentions Counter
- Bar chart showing activity per person
- Sorted by most mentions
- Based on "who did what" data

### 5. Confidence Indicators
- **High** (Green) - 80%+ confidence
- **Medium** (Yellow) - 50-80% confidence
- **Low** (Red) - Below 50% confidence

## Common Actions

### Start New Analysis
Click "New Analysis" button in header

### Navigate Tabs
Click tab names at top of dashboard

### Scroll Long Content
Use mouse wheel or click-drag on scrollbars

### View Evidence
Evidence snippets show timestamps and quotes

## Troubleshooting

### Frontend Won't Start

**Error: Port 3000 in use**
```bash
PORT=3001 npm run dev
```

**Error: Module not found**
```bash
rm -rf node_modules
npm install
```

### API Connection Failed

**Error: Failed to fetch**

Check:
1. Backend is running: http://localhost:8000
2. Check backend health: http://localhost:8000/health
3. `.env.local` has correct URL

### File Upload Fails

**Error: File must be .vtt**

Ensure your file:
- Has `.vtt` extension
- Is a valid WebVTT format
- Is under 10MB

### Dashboard Not Showing

**Error: Processing failed**

Check:
1. Backend logs for errors
2. File format is correct
3. OLLAMA_API_KEY is set
4. Backend has internet connection

## Tips

1. **Processing Time**:
   - 30-min meeting ~5-10 minutes
   - 1-hour meeting ~10-20 minutes

2. **Best Experience**:
   - Use Chrome or Firefox
   - Full screen for best layout
   - Desktop recommended

3. **Multiple Analyses**:
   - Click "New Analysis" to start fresh
   - Previous data is cleared

4. **Printing/Exporting**:
   - Use browser print (Ctrl/Cmd + P)
   - Select specific tabs to print

## Next Steps

1. **Test with Sample File**
   - Use a short (5-10 min) meeting first
   - Verify all features work

2. **Explore All Tabs**
   - Check each tab has data
   - Verify UI looks correct

3. **Report Issues**
   - Note any errors in console (F12)
   - Check browser compatibility

## File Structure Overview

```
frontend/
├── app/
│   ├── page.tsx          # Main page with upload and dashboard
│   └── layout.tsx        # Root layout
├── components/
│   ├── FileUpload.tsx    # Drag & drop upload
│   ├── MeetingDashboard.tsx  # Main dashboard
│   └── dashboard/        # All feature components
├── lib/
│   ├── api.ts           # Backend API calls
│   └── utils.ts         # Utility functions
└── types/
    └── api.ts           # TypeScript interfaces
```

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
```

## Environment Variables

File: `.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Change if backend runs on different host/port.

## Support

If you encounter issues:
1. Check console for errors (F12)
2. Verify backend is running
3. Check network tab for failed requests
4. Review backend logs

## Success Checklist

✅ Dependencies installed
✅ Dev server running on port 3000
✅ Backend running on port 8000
✅ Can upload .vtt file
✅ Dashboard loads with data
✅ All 5 tabs work
✅ All 12 UI components visible

You're all set! Enjoy your meeting summarizer!
