"""
WebSocket handlers for LeetSpeak Backend
Handles extension communication and scraping data
"""
import asyncio
import json
import logging
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


async def handle_extension_websocket(websocket: WebSocket, session_id: str, session_manager, app_state):
    """Handle WebSocket connection from Chrome extension"""
    await websocket.accept()
    session_manager.websocket_connections[session_id] = websocket
    
    try:
        session_manager.update_session(session_id, {"websocket_connected": True})
        logger.info(f"Extension WebSocket connected: {session_id[:8]}")
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await handle_extension_message(session_id, message, websocket, session_manager, app_state)
            
    except WebSocketDisconnect:
        logger.info(f"Extension WebSocket disconnected: {session_id[:8]}")
        session_manager.update_session(session_id, {"websocket_connected": False})
    except Exception as e:
        logger.error(f"WebSocket error for {session_id[:8]}: {e}")
    finally:
        session_manager.websocket_connections.pop(session_id, None)


async def handle_extension_message(session_id: str, message: dict, websocket: WebSocket, session_manager, app_state):
    """Process messages from Chrome extension"""
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
    if session_id not in getattr(app_state, 'relay_tasks', {}):
        if not hasattr(app_state, 'relay_tasks'):
            app_state.relay_tasks = {}
        app_state.relay_tasks[session_id] = asyncio.create_task(
            relay_azure_messages(session_id, websocket, session_manager, app_state)
        )


async def handle_scraping_websocket(websocket: WebSocket, session_manager):
    """Handle WebSocket connection for scraping data"""
    await websocket.accept()
    logger.info("🔗 Scraping WebSocket connected")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Enhanced logging for received messages (preserved from original)
            logger.info("🔍 SCRAPING WEBSOCKET - MESSAGE RECEIVED")
            logger.info(f"🔍 Raw message keys: {list(message.keys())}")
            logger.info(f"🔍 Message type: {message.get('type', 'N/A')}")
            logger.debug(f"🔍 Full message: {message}")
            
            # Try to get the current active session ID
            active_session_id = None
            if session_manager.azure_connections:
                # Use the most recent active session
                active_session_id = list(session_manager.azure_connections.keys())[-1]
                logger.info(f"🎯 Using active session ID: {active_session_id}")
            else:
                logger.warning("⚠️ No active Azure sessions found")
            
            active_session_id = session_manager.get_active_session_id()
            await handle_scraping_message(message, session_manager, active_session_id)
            
    except WebSocketDisconnect:
        logger.info("⚠️ Scraping WebSocket disconnected")
    except Exception as e:
        logger.error(f"❌ Scraping WebSocket error: {e}")


async def handle_scraping_message(message: dict, session_manager, session_id: str = None):
    """Process scraping data updates"""
    message_type = message.get("type")
    
    # Extract content from the nested structure that the scraper sends
    data = message.get("data", {})
    raw_content = data.get("content", "") if isinstance(data, dict) else str(message.get("content", ""))
    
    # Clean up content - remove unicode characters and normalize spaces
    content = raw_content.replace('\u00a0', ' ').replace('\xa0', ' ').strip()
    
    # Enhanced logging - print current session state BEFORE update (preserved from original)
    logger.info("📋 BEFORE SESSION UPDATE:")
    if hasattr(session_manager, 'scraping_data') and session_manager.scraping_data:
        current_data = session_manager.scraping_data
        logger.info(f"📋 Current Title: {current_data.get('title', 'N/A')}")
        logger.info(f"📋 Current Description Length: {len(current_data.get('description', ''))}")
        logger.info(f"📋 Current Editor Length: {len(current_data.get('editor', ''))}")
        logger.info(f"📋 Current Code Length: {len(current_data.get('code', ''))}")
    else:
        logger.info("📋 No current scraping data - initializing...")
        if not hasattr(session_manager, 'scraping_data'):
            session_manager.scraping_data = {}
    
    logger.info(f"🔄 Processing message type: {message_type}")
    logger.info(f"🔄 Raw content length: {len(raw_content)}")
    logger.info(f"🔄 Cleaned content length: {len(content)}")
    logger.debug(f"🔄 Content preview: {content[:200]}{'...' if len(content) > 200 else ''}")
    
    if message_type == "editor_update":
        # Store the editor content
        session_manager.scraping_data["editor"] = content
        session_manager.scraping_data["code"] = content  # Also store as 'code' for AI context
        session_manager.scraping_data["code_timestamp"] = data.get("timestamp", "") if isinstance(data, dict) else ""
        logger.info(f"✏️ Updated editor content ({len(content)} chars)")
        logger.info(f"✏️ Code updated ({len(content)} chars): {content[:50]}...")
        
        # Send context update to active Azure sessions
        if session_id and len(content.strip()) > 0:
            await send_context_update_to_active_session(session_manager, session_id, "code", content)
        
    elif message_type == "description_update":
        # Store the description content
        session_manager.scraping_data["description"] = content
        logger.info(f"📋 Updated description ({len(content)} chars)")
        logger.info(f"📋 Description updated: {content[:100]}...")
        
        # Send context update to active Azure sessions
        if session_id and len(content.strip()) > 0:
            await send_context_update_to_active_session(session_manager, session_id, "problem", content)
    
    elif message_type == "title_update":
        # Store the title content  
        session_manager.scraping_data["title"] = content
        logger.info(f"🏷️ Updated title: {content}")
    
    # Print session state AFTER update (preserved from original)
    logger.info("📋 AFTER SESSION UPDATE:")
    updated_data = session_manager.scraping_data
    logger.info(f"📋 Updated Title: {updated_data.get('title', 'N/A')}")
    logger.info(f"📋 Updated Description Length: {len(updated_data.get('description', ''))}")
    logger.info(f"📋 Updated Editor Length: {len(updated_data.get('editor', ''))}")
    logger.info(f"📋 Updated Code Length: {len(updated_data.get('code', ''))}")
    logger.debug("📋 COMPLETE SESSION DATA TO BE SENT TO AI:")
    logger.debug(f"📋 {json.dumps(updated_data, indent=2)}")


async def send_context_update_to_active_session(session_manager, session_id: str, context_type: str, content: str):
    """Send context updates to active Azure session"""
    try:
        # Detailed logging preserved from original
        logger.info("🔄 SENDING REAL-TIME CONTEXT UPDATE TO AI")
        logger.info(f"🔄 Session ID: {session_id[:8]}...")
        logger.info(f"🔄 Context Type: {context_type}")
        logger.info(f"🔄 Content Length: {len(content)}")
        
        # Clean up content - remove unicode characters and normalize spaces
        cleaned_content = content.replace('\u00a0', ' ').replace('\xa0', ' ').strip()
        logger.info(f"🔄 Cleaned Content Length: {len(cleaned_content)}")
        logger.debug(f"🔄 Content Preview: {cleaned_content[:200]}{'...' if len(cleaned_content) > 200 else ''}")
        
        if not session_id or session_id not in session_manager.azure_connections:
            logger.warning("❌ No active Azure session found for context update")
            return
            
        azure_conn = session_manager.azure_connections[session_id]
        logger.info("✅ Found active Azure connection")
        
        # Create a context update using session.update for real-time updates
        context_update_text = f"[{context_type.upper()} UPDATE] {cleaned_content[:1500]}{'...' if len(cleaned_content) > 1500 else ''}"
        
        # Use session.update to inject context into the active conversation
        context_message = {
            "type": "session.update",
            "session": {
                "instructions": f"REAL-TIME UPDATE: The user has updated their {context_type}. Current {context_type}: {context_update_text}. Please acknowledge this update briefly and provide relevant guidance based on the new content."
            }
        }
        
        logger.info("📤 Sending session update to Azure...")
        logger.info(f"📤 Update text length: {len(context_update_text)}")
        logger.debug(f"📤 Message type: session.update")
        
        await azure_conn.send(json.dumps(context_message))
        logger.info(f"✅ Successfully sent {context_type} context update to Azure session {session_id[:8]}")
        
    except Exception as e:
        logger.error(f"❌ Failed to send context update: {e}")


async def relay_azure_messages(session_id: str, websocket: WebSocket, session_manager, app_state):
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
        logger.error(f"Error relaying Azure messages for {session_id[:8]}: {e}")
    finally:
        if hasattr(app_state, 'relay_tasks') and session_id in app_state.relay_tasks:
            del app_state.relay_tasks[session_id]