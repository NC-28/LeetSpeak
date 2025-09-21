#!/usr/bin/env python3
"""
FastAPI Backend Server for LeetSpeak Chrome Extension
Handles Azure Voice Live API integration, session management, and webscraping data processing
"""

import asyncio
import base64
import json
import logging
import os
import uuid
from datetime import datetime
from typing import Dict, Optional, Set
import websockets

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

from azure.core.credentials import TokenCredential
from azure.identity import DefaultAzureCredential
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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

# Global state management
class SessionManager:
    def __init__(self):
        self.active_sessions: Dict[str, dict] = {}
        self.websocket_connections: Dict[str, WebSocket] = {}
        self.azure_connections: Dict[str, any] = {}
        self.scraping_data: Dict[str, dict] = {"editor": "", "description": ""}
        
    def create_session(self, session_id: str) -> dict:
        session = {
            "id": session_id,
            "status": "created",
            "created_at": datetime.utcnow().isoformat(),
            "azure_connected": False,
            "websocket_connected": False
        }
        self.active_sessions[session_id] = session
        return session
    
    def get_session(self, session_id: str) -> Optional[dict]:
        return self.active_sessions.get(session_id)
    
    def update_session(self, session_id: str, updates: dict):
        if session_id in self.active_sessions:
            self.active_sessions[session_id].update(updates)
    
    def delete_session(self, session_id: str):
        self.active_sessions.pop(session_id, None)
        self.websocket_connections.pop(session_id, None)
        self.azure_connections.pop(session_id, None)

# Global session manager
session_manager = SessionManager()

# Pydantic models
class SessionCreateRequest(BaseModel):
    endpoint: Optional[str] = None
    model: str = "gpt-4o-mini"
    api_key: Optional[str] = None
    context: Optional[dict] = None  # LeetCode problem context

class SessionResponse(BaseModel):
    session_id: str
    status: str
    message: str

class ScrapingData(BaseModel):
    editor_content: str
    description_content: str

# Azure Voice Live Client (adapted from original code)
class VoiceLiveConnection:
    def __init__(self, url: str, headers: dict) -> None:
        self._url = url
        self._headers = headers
        self._ws = None
        self._message_queue = asyncio.Queue()
        self._connected = False

    async def connect(self) -> None:
        try:
            self._ws = await websockets.connect(
                self._url,
                extra_headers=self._headers
            )
            self._connected = True
            logger.info("WebSocket connection to Azure established")
        except Exception as e:
            logger.error(f"Failed to connect to Azure Voice Live API: {e}")
            raise

    async def recv(self) -> Optional[str]:
        try:
            if self._ws:
                message = await self._ws.recv()
                return message
        except websockets.exceptions.ConnectionClosed:
            self._connected = False
        except Exception as e:
            logger.error(f"Error receiving message: {e}")
        return None

    async def send(self, message: str) -> None:
        if self._ws and self._connected:
            await self._ws.send(message)

    async def close(self) -> None:
        if self._ws:
            await self._ws.close()
            self._connected = False

class AzureVoiceLive:
    def __init__(self, azure_endpoint: str, api_version: str, token: str = None, api_key: str = None):
        self._azure_endpoint = azure_endpoint
        self._api_version = api_version
        self._token = token
        self._api_key = api_key
        self._connection = None

    async def connect(self, model: str) -> VoiceLiveConnection:
        if not model:
            raise ValueError("Model name is required.")

        azure_ws_endpoint = self._azure_endpoint.rstrip('/').replace("https://", "wss://")
        url = f"{azure_ws_endpoint}/voice-live/realtime?api-version={self._api_version}&model={model}"

        auth_header = {"Authorization": f"Bearer {self._token}"} if self._token else {"api-key": self._api_key}
        request_id = uuid.uuid4()
        headers = {"x-ms-client-request-id": str(request_id), **auth_header}

        self._connection = VoiceLiveConnection(url, headers)
        await self._connection.connect()
        return self._connection

# API Endpoints
@app.post("/api/sessions", response_model=SessionResponse)
async def create_session(request: SessionCreateRequest):
    """Create a new voice chat session"""
    try:
        session_id = str(uuid.uuid4())
        session = session_manager.create_session(session_id)
        
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
        await send_session_configuration(connection, session_id, request.context)
        
        session_manager.update_session(session_id, {
            "status": "active",
            "azure_connected": True,
            "model": model,
            "context": request.context
        })
        
        return {"status": "started", "message": "Azure Voice Live session started"}
        
    except Exception as e:
        logger.error(f"Error starting session {session_id}: {e}")
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
        
        return {"status": "stopped", "message": "Session stopped successfully"}
        
    except Exception as e:
        logger.error(f"Error stopping session {session_id}: {e}")
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

async def send_session_configuration(connection: VoiceLiveConnection, session_id: str, context: dict = None):
    """Send session configuration to Azure Voice Live API"""
    # Get current scraping data for the prompt
    raw_editor = session_manager.scraping_data.get("editor", "") or session_manager.scraping_data.get("code", "")
    raw_description = session_manager.scraping_data.get("description", "")
    raw_title = session_manager.scraping_data.get("title", "")
    
    # Clean up content - remove unicode characters and normalize spaces
    editor = raw_editor.replace('\u00a0', ' ').replace('\xa0', ' ').strip()
    description = raw_description.replace('\u00a0', ' ').replace('\xa0', ' ').strip()
    title = raw_title.replace('\u00a0', ' ').replace('\xa0', ' ').strip()
    
    # Enhanced logging - show what data we're working with
    print("=" * 80)
    print("🎯 PREPARING AI SESSION CONFIGURATION")
    print(f"🎯 Session ID: {session_id}")
    print(f"🎯 Scraped Title: '{title}'")
    print(f"🎯 Scraped Editor Content Length: {len(editor)}")
    print(f"🎯 Scraped Description Length: {len(description)}")
    print(f"🎯 Additional Context Provided: {bool(context)}")
    
    if context:
        print(f"🎯 Context Title: {context.get('title', 'N/A')}")
        print(f"🎯 Context Description Length: {len(context.get('description', ''))}")
        print(f"🎯 Context Code Length: {len(context.get('code', ''))}")
        print(f"🎯 Context Test Cases: {bool(context.get('testCases'))}")
    
    # Build context information - prioritize scraped data over context parameter
    context_info = ""
    
    # Use scraped data first, then fallback to context parameter
    current_title = title or (context.get('title') if context else "")
    current_description = description or (context.get('description') if context else "")
    current_code = editor or (context.get('code') if context else "")
    
    if current_title:
        context_info += f"\n\n**Current Problem**: {current_title}"
    if current_description:
        context_info += f"\n\n**Problem Description**: {current_description}"
    if current_code:
        context_info += f"\n\n**Current Code**: \n```\n{current_code}\n```"
    if context and context.get("testCases"):
        context_info += f"\n\n**Test Cases**: {context['testCases']}"

    instructions = f"""
You are NOT an assistant, tutor, or collaborator.  
You are an AI Technical Interviewer for a high-stakes coding interview (LeetCode-style).  
Act like a real interviewer: professional, concise, and evaluative.  
Speak as if you are on a live voice call.  

The candidate can already see the full problem and their code on screen.  
The system will provide two reference variables ONCE at the start:  
{current_description} = the problem statement  
{current_code} = the candidate’s current code  

Rules for variables:  
• Use them only as context. Never repeat or output them verbatim.  
• Refer indirectly in plain language or pseudocode.  
  - Example: `len(nums)` → “the length of nums.”  
  - Example: `for i in range(len(nums))` → “loop through the indices of nums.”  
  - Example: `nums[i] + nums[j]` → “sum of element i and element j.”  

--- Interview Flow ---
1. **Opening**  
   - Start direct: “Walk me through your approach.”  

2. **During Live Coding**  
   - React concisely to changes in the candidate's current code.  
   - Acknowledge progress in plain language.  
   - Ask focused questions only tied to what they say or write.  

3. **If Stuck**  
   - Give short nudges, never full strategies.  
   - Example: “Could that be done without scanning twice?”  

4. **Validation & Edge Cases**  
   - Challenge directly: “What happens if the array is empty?”  
   - “Walk through your code with a small example.”  

5. **Optimization**  
   - Push briefly once solution works:  
     “What’s the complexity?”  
     “Can you do better in linear time?”  

6. **Follow-Ups**  
   - Short variations: “How would this change if input was sorted?”  

7. **Wrap-Up (ONLY when candidate says ‘I am finished’)**  
   - Give concise feedback:  
     • Strengths.  
     • Weaknesses.  
     • One improvement.  

--- Tone & Style ---
• Always concise — 1–2 sentences max.  
• End turns with a clear question.  
• Stay evaluative, never explanatory.  
• Refer to code only as pseudocode/intent, not syntax.  
• Maintain realistic interview pressure.  
• Never provide full solutions.  
• Do not end until the candidate explicitly says they are finished.  

"""


    print("🎯 FINAL CONTEXT INFO THAT WILL BE SENT TO AI:")
    print(f"🎯 Using Title: '{current_title}'")
    print(f"🎯 Using Description Length: {len(current_description)}")
    print(f"🎯 Using Code Length: {len(current_code)}")
    print(f"🎯 Context Length: {len(context_info)}")
    print("🎯 Context Content:")
    print(current_description)
    print(current_code)
    print("🎯 COMPLETE AI INSTRUCTIONS:")
    print(instructions)
    print("=" * 80)

    session_update = {
        "type": "session.update",
        "session": {
            "instructions": instructions,
            "input_audio_transcription": {
                "model": "whisper-1",
                "language": "en"
            },
            "turn_detection": {
                "type": "azure_semantic_vad",
                "threshold": 0.2,
                "prefix_padding_ms": 200,
                "silence_duration_ms": 200,
                "remove_filler_words": True,
                "end_of_utterance_detection": {
                    "model": "semantic_detection_v1",
                    "threshold": 0.005,
                    "timeout": 1,
                },
            },
            "input_audio_noise_reduction": {
                "type": "azure_deep_noise_suppression"
            },
            "input_audio_echo_cancellation": {
                "type": "server_echo_cancellation"
            },
            "voice": {
                "name": "en-US-Ava:DragonHDLatestNeural",
                "type": "azure-standard",
                "temperature": 0.7,
                "rate": "1.25",
            },
        },
        "event_id": ""
    }
    
    await connection.send(json.dumps(session_update))
    logger.info(f"Session configuration sent for session {session_id}")

# WebSocket endpoints
@app.websocket("/ws/extension/{session_id}")
async def websocket_extension_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for Chrome extension communication"""
    await websocket.accept()
    session_manager.websocket_connections[session_id] = websocket
    
    try:
        session_manager.update_session(session_id, {"websocket_connected": True})
        logger.info(f"Extension WebSocket connected for session {session_id}")
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            await handle_extension_message(session_id, message, websocket)
            
    except WebSocketDisconnect:
        logger.info(f"Extension WebSocket disconnected for session {session_id}")
        session_manager.update_session(session_id, {"websocket_connected": False})
    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {e}")
    finally:
        session_manager.websocket_connections.pop(session_id, None)

@app.websocket("/ws/scraping")
async def websocket_scraping_endpoint(websocket: WebSocket):
    """WebSocket endpoint for receiving scraping data from content script"""
    await websocket.accept()
    logger.info("🔗 Scraping WebSocket connected")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Enhanced logging for received messages
            print("=" * 80)
            print("🔍 SCRAPING WEBSOCKET - MESSAGE RECEIVED")
            print(f"🔍 Raw message keys: {list(message.keys())}")
            print(f"🔍 Message type: {message.get('type', 'N/A')}")
            print(f"🔍 Full message: {message}")
            print("=" * 80)
            
            # Try to get the current active session ID
            active_session_id = None
            if session_manager.azure_connections:
                # Use the most recent active session
                active_session_id = list(session_manager.azure_connections.keys())[-1]
                print(f"🎯 Using active session ID: {active_session_id}")
            else:
                print("⚠️ No active Azure sessions found")
            
            await handle_scraping_message(message, active_session_id)
            
    except WebSocketDisconnect:
        logger.info("⚠️ Scraping WebSocket disconnected")
    except Exception as e:
        logger.error(f"❌ Scraping WebSocket error: {e}")
        print(f"❌ Scraping WebSocket error: {e}")

async def handle_extension_message(session_id: str, message: dict, websocket: WebSocket):
    """Handle messages from Chrome extension"""
    message_type = message.get("type")
    
    if message_type == "audio_data":
        # Forward audio data to Azure
        if session_id in session_manager.azure_connections:
            azure_conn = session_manager.azure_connections[session_id]
            audio_message = {
                "type": "input_audio_buffer.append",
                "audio": message.get("audio"),
                "event_id": ""
            }
            await azure_conn.send(json.dumps(audio_message))
    
    elif message_type == "ping":
        await websocket.send_text(json.dumps({"type": "pong"}))
    
    # Start background task to relay Azure messages back to extension
    if session_id not in getattr(app.state, 'relay_tasks', {}):
        if not hasattr(app.state, 'relay_tasks'):
            app.state.relay_tasks = {}
        app.state.relay_tasks[session_id] = asyncio.create_task(
            relay_azure_messages(session_id, websocket)
        )

async def handle_scraping_message(message: dict, session_id: str = None):
    """Handle scraping data updates"""
    message_type = message.get("type")
    
    # Extract content from the nested structure that the scraper sends
    data = message.get("data", {})
    raw_content = data.get("content", "") if isinstance(data, dict) else str(message.get("content", ""))
    
    # Clean up content - remove unicode characters and normalize spaces
    content = raw_content.replace('\u00a0', ' ').replace('\xa0', ' ').strip()
    
    # Enhanced logging - print current session state BEFORE update
    print("=" * 80)
    print("📋 BEFORE SESSION UPDATE:")
    if hasattr(session_manager, 'scraping_data') and session_manager.scraping_data:
        current_data = session_manager.scraping_data
        print(f"📋 Current Title: {current_data.get('title', 'N/A')}")
        print(f"📋 Current Description Length: {len(current_data.get('description', ''))}")
        print(f"📋 Current Editor Length: {len(current_data.get('editor', ''))}")
        print(f"📋 Current Code Length: {len(current_data.get('code', ''))}")
    else:
        print("📋 No current scraping data - initializing...")
        if not hasattr(session_manager, 'scraping_data'):
            session_manager.scraping_data = {}
    
    print(f"🔄 Processing message type: {message_type}")
    print(f"🔄 Raw content length: {len(raw_content)}")
    print(f"🔄 Cleaned content length: {len(content)}")
    print(f"🔄 Content preview: {content[:200]}{'...' if len(content) > 200 else ''}")
    
    if message_type == "editor_update":
        # Store the editor content
        session_manager.scraping_data["editor"] = content
        session_manager.scraping_data["code"] = content  # Also store as 'code' for AI context
        session_manager.scraping_data["code_timestamp"] = data.get("timestamp", "") if isinstance(data, dict) else ""
        print(f"✏️ Updated editor content ({len(content)} chars)")
        logger.info(f"✏️ Code updated ({len(content)} chars): {content[:50]}...")
        
        # Send context update to active Azure sessions
        if session_id and len(content.strip()) > 0:
            await send_context_update_to_azure(session_id, "code", content)
        
    elif message_type == "description_update":
        # Store the description content
        session_manager.scraping_data["description"] = content
        print(f"📋 Updated description ({len(content)} chars)")
        logger.info(f"📋 Description updated: {content[:100]}...")
        
        # Send context update to active Azure sessions
        if session_id and len(content.strip()) > 0:
            await send_context_update_to_azure(session_id, "problem", content)
    
    elif message_type == "title_update":
        # Store the title content  
        session_manager.scraping_data["title"] = content
        print(f"🏷️ Updated title: {content}")
    
    # Print session state AFTER update
    print("📋 AFTER SESSION UPDATE:")
    updated_data = session_manager.scraping_data
    print(f"📋 Updated Title: {updated_data.get('title', 'N/A')}")
    print(f"📋 Updated Description Length: {len(updated_data.get('description', ''))}")
    print(f"📋 Updated Editor Length: {len(updated_data.get('editor', ''))}")
    print(f"📋 Updated Code Length: {len(updated_data.get('code', ''))}")
    print("📋 COMPLETE SESSION DATA TO BE SENT TO AI:")
    print(f"📋 {json.dumps(updated_data, indent=2)}")
    print("=" * 80)

async def send_context_update_to_azure(session_id: str, context_type: str, content: str):
    """Send context updates to Azure Voice Live session"""
    try:
        print("=" * 80)
        print("🔄 SENDING REAL-TIME CONTEXT UPDATE TO AI")
        print(f"🔄 Session ID: {session_id[:8]}...")
        print(f"🔄 Context Type: {context_type}")
        print(f"🔄 Content Length: {len(content)}")
        
        # Clean up content - remove unicode characters and normalize spaces
        cleaned_content = content.replace('\u00a0', ' ').replace('\xa0', ' ').strip()
        print(f"🔄 Cleaned Content Length: {len(cleaned_content)}")
        print(f"🔄 Content Preview: {cleaned_content[:200]}{'...' if len(cleaned_content) > 200 else ''}")
        
        if not session_id or session_id not in session_manager.azure_connections:
            print("❌ No active Azure session found for context update")
            logger.warning(f"No active Azure session found for context update")
            return
            
        azure_conn = session_manager.azure_connections[session_id]
        print(f"✅ Found active Azure connection")
        
        # Create a context update using session.update for real-time updates
        # This is the correct format for updating context during an active session
        context_update_text = f"[{context_type.upper()} UPDATE] {cleaned_content[:1500]}{'...' if len(cleaned_content) > 1500 else ''}"
        
        # Use session.update to inject context into the active conversation
        context_message = {
            "type": "session.update",
            "session": {
                "instructions": f"REAL-TIME UPDATE: The user has updated their {context_type}. Current {context_type}: {context_update_text}. Please acknowledge this update briefly and provide relevant guidance based on the new content."
            }
        }
        
        print(f"📤 Sending session update to Azure...")
        print(f"📤 Update text length: {len(context_update_text)}")
        print(f"📤 Message type: session.update")
        
        await azure_conn.send(json.dumps(context_message))
        print(f"✅ Successfully sent {context_type} context update to Azure session {session_id[:8]}")
        logger.info(f"📤 Sent {context_type} context update to Azure session {session_id[:8]}")
        print("=" * 80)
        
    except Exception as e:
        print(f"❌ Failed to send context update: {e}")
        logger.error(f"Failed to send context update: {e}")
        print("=" * 80)

async def relay_azure_messages(session_id: str, websocket: WebSocket):
    """Relay messages from Azure to Chrome extension"""
    try:
        if session_id not in session_manager.azure_connections:
            return
            
        azure_conn = session_manager.azure_connections[session_id]
        
        while True:
            azure_message = await azure_conn.recv()
            if azure_message:
                # Forward Azure message to extension
                await websocket.send_text(azure_message)
            else:
                await asyncio.sleep(0.1)
                
    except Exception as e:
        logger.error(f"Error relaying Azure messages for session {session_id}: {e}")
    finally:
        if hasattr(app.state, 'relay_tasks') and session_id in app.state.relay_tasks:
            del app.state.relay_tasks[session_id]

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    # Run the FastAPI server
    uvicorn.run(
        "backend_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )