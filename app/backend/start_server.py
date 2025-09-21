#!/usr/bin/env python3
"""
LeetSpeak Backend Server Startup Script
Run this to start the FastAPI backend server for the LeetSpeak Chrome Extension
"""

import os
import sys
import asyncio
import uvicorn
from pathlib import Path
import logging

def main():
    """Main startup function"""
    print("🚀 Starting LeetSpeak Backend Server")
    print("=" * 50)
    
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    # Check if .env file exists
    env_file = Path(".env")
    if not env_file.exists():
        print("⚠️  Warning: .env file not found!")
        print("Please create a .env file with the following variables:")
        print("AZURE_VOICE_LIVE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/")
        print("AZURE_VOICE_LIVE_API_KEY=your-api-key-here")
        print("AZURE_VOICE_LIVE_API_VERSION=2025-05-01-preview")
        print("VOICE_LIVE_MODEL=gpt-4o-mini")
        print()
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher is required")
        sys.exit(1)
    
    print("✅ Python version:", sys.version)
    
    # Check if virtual environment is recommended
    if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print("💡 Tip: Consider using a virtual environment:")
        print("   python -m venv venv")
        print("   venv\\Scripts\\activate  # Windows")
        print("   source venv/bin/activate  # Linux/Mac")
        print()
    
    print("🌐 Starting FastAPI server...")
    print("📡 Backend API: http://localhost:8000")
    print("📋 API Documentation: http://localhost:8000/docs")
    print("🔗 WebSocket Endpoints:")
    print("   - Extension: ws://localhost:8000/ws/extension/{session_id}")
    print("   - Scraping: ws://localhost:8000/ws/scraping")
    print()
    print("📝 Press Ctrl+C to stop the server")
    print("=" * 50)
    
    # Setup logging directory info
    logs_dir = script_dir / "logs"
    print(f"📁 Logs will be written to: {logs_dir.absolute()}")
    
    try:
        # Import and run the server
        uvicorn.run(
            "endpoints:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info",
            access_log=True
        )
    except KeyboardInterrupt:
        print("\n👋 Server stopped.")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        print("Make sure all dependencies are installed:")
        print("pip install -r requirements.txt")
        sys.exit(1)

if __name__ == "__main__":
    main()