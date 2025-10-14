# Meeting Summarizer Frontend

Modern, sleek Next.js frontend for the Meeting Summarizer application. Built with Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

### 12 Comprehensive UI Components

1. **Meeting Details Header**
   - Meeting title, date, duration
   - Participant list with badges
   - Unknown participant count

2. **Meeting Summary**
   - AI-generated comprehensive summary
   - Scrollable content area

3. **Chapters Section**
   - Topic-based chapters
   - Chapter summaries
   - Segment ID tracking

4. **Timeline Bar**
   - Visual meeting duration
   - Chapter markers
   - Key timeline points

5. **Six Thinking Hats System**
   - Color-coded hat analysis
   - Per-member hat breakdown
   - Hat descriptions and evidence

6. **Decision Flow Diagram**
   - Visual decision tree
   - Decision makers
   - Impact analysis

7. **Mentions Counter**
   - Activity tracking per person
   - Visual bar chart
   - Sorted by mentions

8. **Tasks & To-Dos**
   - Self-assigned tasks
   - Tasks assigned by others
   - Status and owner tracking

9. **Deadlines List**
   - Upcoming deadlines
   - Sorted by date
   - Assignee information

10. **Decisions List**
    - All decisions made
    - Decision makers
    - Evidence with timestamps

11. **Achievements**
    - Per-member achievements
    - Evidence snippets
    - Confidence ratings

12. **Blockers**
    - Per-member blockers
    - Responsible owners
    - Evidence and confidence

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Diagrams**: ReactFlow (for decision diagrams)

## Installation

### Prerequisites

- Node.js 18+ installed
- Backend API running on http://localhost:8000

### Setup

1. **Navigate to frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**

The `.env.local` file is already set up with:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

If your backend runs on a different port, update this value.

4. **Start development server**
```bash
npm run dev
```

5. **Open browser**

Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Main page
│   └── globals.css             # Global styles
├── components/
│   ├── ui/                     # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── tabs.tsx
│   │   └── ...
│   ├── dashboard/              # Feature components
│   │   ├── MeetingHeader.tsx
│   │   ├── MeetingSummary.tsx
│   │   ├── ChaptersList.tsx
│   │   ├── TimelineBar.tsx
│   │   ├── HatSystem.tsx
│   │   ├── DecisionDiagram.tsx
│   │   ├── MentionsCounter.tsx
│   │   ├── TasksList.tsx
│   │   ├── DeadlinesList.tsx
│   │   ├── DecisionsList.tsx
│   │   ├── AchievementsList.tsx
│   │   └── BlockersList.tsx
│   ├── FileUpload.tsx          # File upload component
│   └── MeetingDashboard.tsx    # Main dashboard
├── lib/
│   ├── api.ts                  # API service layer
│   └── utils.ts                # Utility functions
├── types/
│   └── api.ts                  # TypeScript types
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Usage

### 1. Upload Transcript

1. Click the upload area or drag & drop a `.vtt` file
2. Click "Analyze Meeting"
3. Wait for processing (may take a few minutes)

### 2. View Dashboard

Once processing is complete, you'll see:

- **Overview Tab**: Summary, mentions, achievements, blockers, deadlines
- **Chapters Tab**: All meeting chapters with summaries
- **Tasks & Items Tab**: Tasks and who-did-what activities
- **People Tab**: Hat analysis and per-person insights
- **Decisions Tab**: Decision flow diagram and decision list

### 3. Navigate

Use the tab navigation to explore different aspects of the meeting.

## Component Details

### Meeting Header
Shows key meeting metadata with a gradient background.

### Timeline Bar
Visual representation of meeting duration with chapter markers and key points.

### Six Thinking Hats
Color-coded analysis:
- **White**: Facts & Data (Gray)
- **Red**: Emotions & Feelings (Red)
- **Black**: Critical Thinking (Dark)
- **Yellow**: Optimism & Benefits (Yellow)
- **Green**: Creativity & Ideas (Green)
- **Blue**: Process & Organization (Blue)

### Decision Diagram
Tree-style visualization of decisions with:
- Decision nodes
- Decision makers
- Impact statements

### Confidence Indicators
All extracted items show confidence levels:
- **High** (≥0.8): Green
- **Medium** (0.5-0.8): Yellow
- **Low** (<0.5): Red

## Customization

### Colors

Edit `tailwind.config.ts` to customize the color palette:

```typescript
theme: {
  extend: {
    colors: {
      primary: "...",
      secondary: "...",
      // ... more colors
    }
  }
}
```

### Components

All components are modular and can be customized individually in the `components/dashboard/` directory.

## Build for Production

```bash
npm run build
npm start
```

The production build will be created in the `.next` directory.

## Troubleshooting

### Port Already in Use

If port 3000 is in use:

```bash
PORT=3001 npm run dev
```

### API Connection Failed

Ensure:
1. Backend is running on http://localhost:8000
2. `.env.local` has correct `NEXT_PUBLIC_API_URL`
3. CORS is enabled on backend

### TypeScript Errors

Run type checking:

```bash
npx tsc --noEmit
```

### Build Errors

Clear Next.js cache:

```bash
rm -rf .next
npm run dev
```

## Development

### Adding New Components

1. Create component in `components/dashboard/`
2. Import and use in `MeetingDashboard.tsx`
3. Add TypeScript types in `types/api.ts` if needed

### Styling

Use Tailwind CSS utility classes. For custom styles, edit `app/globals.css`.

### API Integration

API calls are in `lib/api.ts`. Add new endpoints there.

## Performance

- **Code Splitting**: Automatic with Next.js App Router
- **Lazy Loading**: Dashboard components load on demand
- **Image Optimization**: Built-in with Next.js
- **CSS Optimization**: Tailwind purges unused styles in production

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## License

MIT
