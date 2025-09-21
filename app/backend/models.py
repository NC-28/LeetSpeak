"""
Pydantic models and data structures for LeetSpeak Backend
"""
from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime


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


class Session:
    """Session data structure"""
    def __init__(self, session_id: str):
        self.id = session_id
        self.status = "created"
        self.created_at = datetime.utcnow().isoformat()
        self.azure_connected = False
        self.websocket_connected = False
        self.model = None
        self.context = None
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "status": self.status,
            "created_at": self.created_at,
            "azure_connected": self.azure_connected,
            "websocket_connected": self.websocket_connected,
            "model": self.model,
            "context": self.context
        }
    
    def update(self, updates: dict):
        for key, value in updates.items():
            if hasattr(self, key):
                setattr(self, key, value)