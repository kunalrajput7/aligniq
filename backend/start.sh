#!/bin/bash
# Start script for Meeting Summarizer Backend

echo "Starting Meeting Summarizer Backend..."
echo "==========================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check for OLLAMA_API_KEY
if [ -z "$OLLAMA_API_KEY" ]; then
    echo "WARNING: OLLAMA_API_KEY environment variable is not set!"
    echo "Please set it or create a .env file"
fi

# Start server
echo "Starting FastAPI server..."
echo "==========================================="
echo "API: http://localhost:8000"
echo "Docs: http://localhost:8000/docs"
echo "==========================================="

uvicorn main:app --reload --host 0.0.0.0 --port 8000
