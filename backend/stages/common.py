"""
Common utilities shared across all stages.
"""
from __future__ import annotations
import os
import time
from typing import List, Dict, Optional
import httpx
from dotenv import load_dotenv

# Load environment variables FIRST
load_dotenv()

# ---------- Defaults / Tunables ----------
DEFAULT_MODEL = os.getenv("SEGMENTS_LLM_MODEL") or os.getenv("AZURE_AI_DEPLOYMENT", "gpt-5-nano")

# Character limits removed for unified architecture
# No need to truncate or limit input size - modern models have large context windows
# Old limits (for reference):
# MAX_CHARS = 14000, COLLECTIVE_MAX_CHARS = 16000, ITEMS_MAX_CHARS = 16000, CHAPTERS_MAX_CHARS = 20000

BAD_MODEL_LITERALS = {"string", "model", ""}

AZURE_AI_ENDPOINT = os.getenv("AZURE_AI_ENDPOINT")
AZURE_AI_KEY = os.getenv("AZURE_AI_KEY")
AZURE_AI_DEPLOYMENT = os.getenv("AZURE_AI_DEPLOYMENT")
AZURE_AI_API_VERSION = os.getenv("AZURE_AI_API_VERSION", "2024-05-01-preview")

# Debug: Print loaded values (will be visible on startup)
print(f"[CONFIG] AZURE_AI_ENDPOINT: {AZURE_AI_ENDPOINT}")
print(f"[CONFIG] AZURE_AI_KEY: {'***' + AZURE_AI_KEY[-4:] if AZURE_AI_KEY else 'NOT SET'}")
print(f"[CONFIG] AZURE_AI_DEPLOYMENT: {AZURE_AI_DEPLOYMENT}")


def _fmt_local(ms: int) -> str:
    """Format milliseconds to HH:MM:SS.mmm"""
    s, ms = divmod(int(ms), 1000)
    m, s = divmod(s, 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def _truncate(text: str, limit: int) -> str:
    """Truncate text to limit, keeping beginning and end."""
    if len(text) <= limit:
        return text
    half = limit // 2
    return text[:half] + "\n...\n" + text[-half:]


def _resolve_model(model: Optional[str]) -> str:
    """Resolve model name, fallback to default."""
    if model is None:
        return DEFAULT_MODEL
    m = model.strip().lower()
    if m in BAD_MODEL_LITERALS:
        return DEFAULT_MODEL
    return model


async def call_ollama_cloud_async(
    model: str,
    messages: List[Dict[str, str]],
    json_mode: bool = True
) -> str:
    """
    Call Azure AI Foundry deployment asynchronously and return response content.

    Args:
        model: Optional override for deployment name
        messages: List of message dicts with 'role' and 'content'
        json_mode: Whether to request JSON-formatted output

    Returns:
        Response content string
    """
    if not (AZURE_AI_ENDPOINT and AZURE_AI_KEY):
        raise RuntimeError("Azure AI credentials are not configured. Please set AZURE_AI_ENDPOINT and AZURE_AI_KEY in .env file")

    # Use the deployment name from env or the provided model parameter
    deployment = AZURE_AI_DEPLOYMENT if not model or _resolve_model(model) == DEFAULT_MODEL else _resolve_model(model)

    # Azure AI Foundry uses OpenAI-compatible endpoint format
    # Format: https://{endpoint}/openai/v1/chat/completions
    # The deployment name goes in the "model" field of the payload
    base_endpoint = AZURE_AI_ENDPOINT.rstrip('/')

    # Ensure endpoint has /openai/v1
    if not base_endpoint.endswith('/openai/v1'):
        if base_endpoint.endswith('/openai'):
            base_endpoint = f"{base_endpoint}/v1"
        else:
            base_endpoint = f"{base_endpoint}/openai/v1"

    url = f"{base_endpoint}/chat/completions"

    headers = {
        "Content-Type": "application/json",
        "api-key": AZURE_AI_KEY
    }

    # Azure AI Foundry uses deployment name in the model field (OpenAI-compatible format)
    payload = {
        "model": deployment,  # Deployment name goes here
        "messages": messages,
        # Removed max_completion_tokens limit - let model use its full capacity
        # GPT-5 Nano supports up to 200K tokens context window
    }

    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        # Calculate and log request size
        import json as json_lib
        payload_size = len(json_lib.dumps(payload))
        print(f"[DEBUG] Calling Azure AI with URL: {url}")
        print(f"[DEBUG] Deployment: {deployment}")
        print(f"[DEBUG] Payload size: {payload_size:,} bytes")
        print(f"[DEBUG] Timeout: 300 seconds (5 minutes)")

        async with httpx.AsyncClient(timeout=300.0) as client:  # 5 minutes timeout for large meetings with reasoning model
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

            print(f"[DEBUG] Response status: {response.status_code}")
            print(f"[DEBUG] Response data keys: {data.keys()}")

            choices = data.get("choices") or [{}]
            message = choices[0].get("message", {})
            content = message.get("content", "")

            if not content:
                print("[ERROR] Azure AI returned empty content. Full response:")
                try:
                    import json as json_lib
                    print(json_lib.dumps(data, indent=2)[:2000])
                except Exception:
                    print(data)
                raise RuntimeError("Azure AI returned an empty response. Please verify the deployment and prompt.")

            print(f"[DEBUG] Content length: {len(content)}")
            print(f"[DEBUG] Content preview: {content[:200]}")

            return content
    except httpx.HTTPStatusError as e:
        detail = e.response.text if hasattr(e.response, 'text') else str(e)
        print(f"[ERROR] Azure AI HTTP Error {e.response.status_code}: {detail}")
        print(f"[ERROR] Request URL: {url}")
        raise RuntimeError(f"Azure AI HTTP error: {e.response.status_code} - {detail}")
    except httpx.RequestError as e:
        print(f"[ERROR] Azure AI Request Error: {str(e)}")
        raise RuntimeError(f"Azure AI request error: {str(e)}")
    except Exception as e:
        print(f"[ERROR] Azure AI Unexpected Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise RuntimeError(f"Azure AI unexpected error: {e}")
