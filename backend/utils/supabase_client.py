"""
Supabase client utilities for database operations.
Handles projects, meetings, and meeting summaries.
"""
import os
from typing import Optional, List, Dict, Any
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

supabase: Client = None

if url and key:
    supabase = create_client(url, key)
else:
    print("[SUPABASE] Warning: SUPABASE_URL or SUPABASE_KEY not set")


def get_supabase_client() -> Optional[Client]:
    """Returns the Supabase client instance."""
    return supabase


# =====================================================
# PROJECT OPERATIONS
# =====================================================

async def create_project(user_id: str, name: str, description: str = None) -> Optional[str]:
    """Creates a new project for a user."""
    if not supabase:
        return None
    
    data = {
        "user_id": user_id,
        "name": name,
        "description": description,
        "status": "active"
    }
    
    try:
        response = supabase.table("projects").insert(data).execute()
        return response.data[0]['id'] if response.data else None
    except Exception as e:
        print(f"[SUPABASE] Error creating project: {e}")
        return None


async def get_user_projects(user_id: str) -> List[Dict[str, Any]]:
    """Gets all projects for a user."""
    if not supabase:
        return []
    
    try:
        response = supabase.table("projects").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"[SUPABASE] Error fetching projects: {e}")
        return []


async def get_project_by_id(project_id: str) -> Optional[Dict[str, Any]]:
    """Gets a project by ID."""
    if not supabase:
        return None
    
    try:
        response = supabase.table("projects").select("*").eq("id", project_id).single().execute()
        return response.data
    except Exception as e:
        print(f"[SUPABASE] Error fetching project: {e}")
        return None


async def update_project(project_id: str, **kwargs) -> bool:
    """Updates a project's fields."""
    if not supabase:
        return False
    
    try:
        supabase.table("projects").update(kwargs).eq("id", project_id).execute()
        return True
    except Exception as e:
        print(f"[SUPABASE] Error updating project: {e}")
        return False


async def delete_project(project_id: str) -> bool:
    """Deletes a project (cascade deletes meetings)."""
    if not supabase:
        return False
    
    try:
        supabase.table("projects").delete().eq("id", project_id).execute()
        return True
    except Exception as e:
        print(f"[SUPABASE] Error deleting project: {e}")
        return False


# =====================================================
# MEETING OPERATIONS
# =====================================================

async def create_meeting_record(
    user_id: str, 
    title: str, 
    date: str, 
    duration_ms: int, 
    participants: list,
    project_id: Optional[str] = None
) -> Optional[str]:
    """Creates a new meeting record in the database."""
    if not supabase:
        return None
    
    data = {
        "user_id": user_id,
        "title": title,
        "date": date,
        "duration_ms": duration_ms,
        "participants": participants,
        "status": "processing"
    }
    
    # Only add project_id if provided (direct meetings have None)
    if project_id:
        data["project_id"] = project_id
    
    try:
        response = supabase.table("meetings").insert(data).execute()
        return response.data[0]['id'] if response.data else None
    except Exception as e:
        print(f"[SUPABASE] Error creating meeting record: {e}")
        return None


async def get_user_meetings(user_id: str, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Gets meetings for a user, optionally filtered by project."""
    if not supabase:
        return []
    
    try:
        query = supabase.table("meetings").select("*").eq("user_id", user_id)
        
        if project_id:
            # Get meetings for a specific project
            query = query.eq("project_id", project_id)
        
        response = query.order("created_at", desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"[SUPABASE] Error fetching meetings: {e}")
        return []


async def get_direct_meetings(user_id: str) -> List[Dict[str, Any]]:
    """Gets meetings that are not associated with any project (direct meetings)."""
    if not supabase:
        return []
    
    try:
        response = supabase.table("meetings").select("*").eq("user_id", user_id).is_("project_id", "null").order("created_at", desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"[SUPABASE] Error fetching direct meetings: {e}")
        return []


async def get_project_meetings(project_id: str) -> List[Dict[str, Any]]:
    """Gets all meetings for a specific project."""
    if not supabase:
        return []
    
    try:
        response = supabase.table("meetings").select("*").eq("project_id", project_id).order("created_at", desc=True).execute()
        return response.data or []
    except Exception as e:
        print(f"[SUPABASE] Error fetching project meetings: {e}")
        return []


async def get_meeting_by_id(meeting_id: str) -> Optional[Dict[str, Any]]:
    """Gets a meeting by ID."""
    if not supabase:
        return None
    
    try:
        response = supabase.table("meetings").select("*").eq("id", meeting_id).single().execute()
        return response.data
    except Exception as e:
        print(f"[SUPABASE] Error fetching meeting: {e}")
        return None


async def update_meeting_status(meeting_id: str, status: str):
    """Updates the status of a meeting."""
    if not supabase:
        return
        
    try:
        supabase.table("meetings").update({"status": status}).eq("id", meeting_id).execute()
    except Exception as e:
        print(f"[SUPABASE] Error updating meeting status: {e}")


async def update_meeting_details(
    meeting_id: str, 
    title: str, 
    duration_ms: int, 
    participants: list,
    timeline_json: Optional[Dict] = None
):
    """Updates the details of a meeting including timeline."""
    if not supabase:
        return
        
    data = {
        "title": title,
        "duration_ms": duration_ms,
        "participants": participants
    }
    
    if timeline_json:
        data["timeline_json"] = timeline_json
    
    try:
        supabase.table("meetings").update(data).eq("id", meeting_id).execute()
    except Exception as e:
        print(f"[SUPABASE] Error updating meeting details: {e}")


async def delete_meeting(meeting_id: str) -> bool:
    """Deletes a meeting and its summary."""
    if not supabase:
        return False
    
    try:
        supabase.table("meetings").delete().eq("id", meeting_id).execute()
        return True
    except Exception as e:
        print(f"[SUPABASE] Error deleting meeting: {e}")
        return False


# =====================================================
# MEETING SUMMARY OPERATIONS
# =====================================================

async def save_meeting_results(
    meeting_id: str, 
    collective_summary: dict, 
    mindmap: dict, 
    chapters: list, 
    hats: list,
    timeline: Optional[list] = None
):
    """Saves the analysis results to the meeting_summaries table."""
    if not supabase:
        return

    data = {
        "meeting_id": meeting_id,
        "summary_json": collective_summary,
        "mindmap_json": mindmap,
        "chapters_json": chapters,
        "hats_json": hats
    }
    
    try:
        # Upsert to handle both insert and update cases
        supabase.table("meeting_summaries").upsert(data).execute()
        
        # Also update status to completed and save timeline to meetings table
        await update_meeting_status(meeting_id, "completed")
        
        if timeline:
            supabase.table("meetings").update({"timeline_json": timeline}).eq("id", meeting_id).execute()
            
    except Exception as e:
        print(f"[SUPABASE] Error saving meeting results: {e}")


async def get_meeting_summary(meeting_id: str) -> Optional[Dict[str, Any]]:
    """Gets the summary for a meeting."""
    if not supabase:
        return None
    
    try:
        response = supabase.table("meeting_summaries").select("*").eq("meeting_id", meeting_id).single().execute()
        return response.data
    except Exception as e:
        print(f"[SUPABASE] Error fetching meeting summary: {e}")
        return None


# =====================================================
# STATS OPERATIONS
# =====================================================

async def get_project_stats(project_id: str) -> Dict[str, Any]:
    """Gets statistics for a project (meeting count, task count, etc.)."""
    if not supabase:
        return {"meetings_count": 0, "tasks_count": 0}
    
    try:
        # Get meetings count
        meetings_response = supabase.table("meetings").select("id", count="exact").eq("project_id", project_id).execute()
        meetings_count = meetings_response.count or 0
        
        # Get completed meetings to count tasks
        summaries_response = supabase.table("meetings").select("id, meeting_summaries(summary_json)").eq("project_id", project_id).eq("status", "completed").execute()
        
        tasks_count = 0
        tasks_done = 0
        for meeting in summaries_response.data or []:
            if meeting.get("meeting_summaries") and meeting["meeting_summaries"].get("summary_json"):
                action_items = meeting["meeting_summaries"]["summary_json"].get("action_items", [])
                tasks_count += len(action_items)
                tasks_done += sum(1 for t in action_items if t.get("status") == "done")
        
        return {
            "meetings_count": meetings_count,
            "tasks_count": tasks_count,
            "tasks_done": tasks_done
        }
    except Exception as e:
        print(f"[SUPABASE] Error fetching project stats: {e}")
        return {"meetings_count": 0, "tasks_count": 0, "tasks_done": 0}


async def get_user_stats(user_id: str) -> Dict[str, Any]:
    """Gets overall statistics for a user."""
    if not supabase:
        return {}
    
    try:
        # Get projects count
        projects_response = supabase.table("projects").select("id", count="exact").eq("user_id", user_id).execute()
        
        # Get meetings count
        meetings_response = supabase.table("meetings").select("id", count="exact").eq("user_id", user_id).execute()
        
        # Get this week's meetings
        from datetime import datetime, timedelta
        week_ago = (datetime.now() - timedelta(days=7)).isoformat()
        recent_response = supabase.table("meetings").select("id", count="exact").eq("user_id", user_id).gte("created_at", week_ago).execute()
        
        return {
            "projects_count": projects_response.count or 0,
            "meetings_count": meetings_response.count or 0,
            "recent_meetings_count": recent_response.count or 0
        }
    except Exception as e:
        print(f"[SUPABASE] Error fetching user stats: {e}")
        return {}
