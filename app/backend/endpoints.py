#!/usr/bin/env python3
"""
FastAPI Backend Server for LeetSpeak Chrome Extension
Handles Azure Voice Live API integration, session management, and webscraping data processing
"""

import asyncio
import logging
import logging.handlers
import os
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv

# Import our modules
from models import SessionCreateRequest, SessionResponse, Session
from session_manager import SessionManager
from azure_client import AzureVoiceLive, send_session_configuration
from websocket_handlers import (
    handle_extension_websocket, 
    handle_scraping_websocket,
    relay_azure_messages
)

# Load environment variables
load_dotenv()

# Configure logging
def setup_logging():
    """Setup logging with both console and file output"""
    # Create logs directory if it doesn't exist
    logs_dir = Path(__file__).parent / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    # Create a custom formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Create root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Clear any existing handlers
    root_logger.handlers.clear()
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # File handler with rotation
    file_handler = logging.handlers.RotatingFileHandler(
        logs_dir / "leetspeak_backend.log",
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)
    
    # Error log file handler
    error_handler = logging.handlers.RotatingFileHandler(
        logs_dir / "leetspeak_errors.log",
        maxBytes=10*1024*1024,  # 10MB
        backupCount=3,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    root_logger.addHandler(error_handler)
    
    return logging.getLogger(__name__)

# Setup logging
logger = setup_logging()

# Log startup message
logger.info("🚀 LeetSpeak Backend Server starting up...")
logger.info(f"📁 Logs directory: {Path(__file__).parent / 'logs'}")

# FastAPI app initialization
app = FastAPI(
    title="LeetSpeak Backend API",
    description="Backend server for LeetSpeak Chrome Extension with Azure Voice Live integration",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global session manager
session_manager = SessionManager()


# Application lifecycle events
@app.on_event("startup")
async def startup_event():
    """Application startup event"""
    logger.info("✅ LeetSpeak Backend Server is ready!")
    logger.info("📡 API Documentation available at: http://localhost:8000/docs")
    logger.info("🔗 WebSocket endpoints ready for connections")

@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event"""
    logger.info("🛑 LeetSpeak Backend Server shutting down...")


# API Endpoints
@app.post("/api/sessions", response_model=SessionResponse)
async def create_session(request: SessionCreateRequest):
    """Create a new voice chat session"""
    try:
        session_id = str(uuid.uuid4())
        session = session_manager.create_session(session_id)
        
        logger.info(f"Session created: {session_id[:8]}")
        return SessionResponse(
            session_id=session_id,
            status="created",
            message="Session created successfully"
        )
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sessions/{session_id}/start")
async def start_session(session_id: str, request: SessionCreateRequest):
    """Start Azure Voice Live connection for a session"""
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get Azure configuration
        endpoint = request.endpoint or os.getenv("AZURE_VOICE_LIVE_ENDPOINT")
        api_key = request.api_key or os.getenv("AZURE_VOICE_LIVE_API_KEY")
        api_version = os.getenv("AZURE_VOICE_LIVE_API_VERSION", "2025-05-01-preview")
        model = request.model

        if not endpoint or not api_key:
            raise HTTPException(status_code=400, detail="Azure endpoint and API key are required")

        # Create Azure connection
        azure_client = AzureVoiceLive(
            azure_endpoint=endpoint,
            api_version=api_version,
            api_key=api_key
        )
        
        connection = await azure_client.connect(model)
        session_manager.azure_connections[session_id] = connection
        
        # Send session configuration with context
        await send_session_configuration(
            connection, 
            session_id, 
            session_manager.scraping_data, 
            request.context
        )
        
        session_manager.update_session(session_id, {
            "status": "active",
            "azure_connected": True,
            "model": model,
            "context": request.context
        })
        
        logger.info(f"Azure session started: {session_id[:8]}")
        return {"status": "started", "message": "Azure Voice Live session started"}
        
    except Exception as e:
        logger.error(f"Error starting session {session_id[:8]}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sessions/{session_id}/stop")
async def stop_session(session_id: str):
    """Stop a voice chat session"""
    try:
        session = session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Close Azure connection
        if session_id in session_manager.azure_connections:
            await session_manager.azure_connections[session_id].close()
            
        session_manager.delete_session(session_id)
        
        logger.info(f"Session stopped: {session_id[:8]}")
        return {"status": "stopped", "message": "Session stopped successfully"}
        
    except Exception as e:
        logger.error(f"Error stopping session {session_id[:8]}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session information"""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.get("/api/sessions")
async def list_sessions():
    """List all active sessions"""
    return {"sessions": list(session_manager.active_sessions.values())}


# WebSocket endpoints
@app.websocket("/ws/extension/{session_id}")
async def websocket_extension_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for Chrome extension communication"""
    await handle_extension_websocket(websocket, session_id, session_manager, app.state)


@app.websocket("/ws/scraping")
async def websocket_scraping_endpoint(websocket: WebSocket):
    """WebSocket endpoint for receiving scraping data from content script"""
    await handle_scraping_websocket(websocket, session_manager)


# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    # Run the FastAPI server
    uvicorn.run(
        "endpoints:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )