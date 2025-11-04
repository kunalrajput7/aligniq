#!/bin/bash

# Azure App Service startup script for FastAPI application
# This tells Azure how to run your Python backend

echo "Starting Meeting Summarizer API..."

# Install dependencies
echo "Installing Python dependencies..."
python -m pip install --upgrade pip
pip install -r requirements.txt

# Start FastAPI with uvicorn
echo "Starting FastAPI server on port 8000..."
python -m uvicorn main:app --host 0.0.0.0 --port 8000
