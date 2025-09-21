"""
Session Management for LeetSpeak Backend
Handles session lifecycle, state, and data storage
"""
import logging
from datetime import datetime
from typing import Dict, Optional
from fastapi import WebSocket

from models import Session

logger = logging.getLogger(__name__)


class SessionManager:
    def __init__(self):
        self.active_sessions: Dict[str, dict] = {}  # Store as dict for original compatibility
        self.websocket_connections: Dict[str, WebSocket] = {}
        self.azure_connections: Dict[str, any] = {}
        self.scraping_data: Dict[str, dict] = {"editor": "", "description": "", "title": ""}
        
    def create_session(self, session_id: str) -> dict:
        session_dict = {
            "id": session_id,
            "status": "created",
            "created_at": datetime.utcnow().isoformat(),
            "azure_connected": False,
            "websocket_connected": False
        }
        self.active_sessions[session_id] = session_dict
        logger.info(f"Session created: {session_id[:8]}")
        return session_dict
    
    def get_session(self, session_id: str) -> Optional[dict]:
        return self.active_sessions.get(session_id)
    
    def update_session(self, session_id: str, updates: dict):
        if session_id in self.active_sessions:
            self.active_sessions[session_id].update(updates)
    
    def delete_session(self, session_id: str):
        self.active_sessions.pop(session_id, None)
        self.websocket_connections.pop(session_id, None)
        self.azure_connections.pop(session_id, None)
        logger.info(f"Session {session_id[:8]} deleted")
    
    def update_scraping_data(self, data_type: str, content: str):
        """Update scraped content with cleaned data"""
        cleaned_content = content.replace('\u00a0', ' ').replace('\xa0', ' ').strip()
        self.scraping_data[data_type] = cleaned_content
        logger.info(f"Updated {data_type} content ({len(cleaned_content)} chars)")
    
    def get_active_session_id(self) -> Optional[str]:
        """Get the most recently active session with Azure connection"""
        if self.azure_connections:
            return list(self.azure_connections.keys())[-1]
        return None