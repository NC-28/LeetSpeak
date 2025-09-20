# LeetSpeak - AI Technical Interview Assistant

## Overview

LeetSpeak is a Chrome extension that provides AI-powered technical interview assistance for LeetCode practice. It integrates with Azure Voice Live API to offer real-time voice conversations with an AI technical interviewer while you solve coding problems.

## Architecture

### Backend (FastAPI)
- **FastAPI Server**: Handles Azure Voice Live API integration, session management, and WebSocket communication
- **Session Management**: Creates and manages voice chat sessions with unique IDs
- **WebSocket Endpoints**: Real-time communication between extension and backend
- **Azure Integration**: Maintains all Azure-related code on the backend for security

### Frontend (Chrome Extension)
- **Popup**: Quick access interface for starting/stopping voice chats
- **Side Panel**: Detailed interface with configuration options and chat history
- **Content Script**: Scrapes LeetCode problem descriptions and editor content in real-time
- **Voice Client**: Handles audio processing and WebSocket communication with backend

## Features

- 🎙️ **Voice Interaction**: Natural conversation with AI technical interviewer
- 🔄 **Real-time Scraping**: Automatically captures problem descriptions and your code
- 🎯 **Context-Aware**: AI understands the current problem and your coding progress
- ⚙️ **Configurable**: Support for different Azure models and voice options
- 🚀 **Production Ready**: Clean architecture with proper error handling and logging

## Quick Start

### Prerequisites
1. Python 3.8+ with pip
2. Node.js 16+ with npm
3. Azure Speech Services account with API key

### Automated Setup (Recommended)
1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd LeetSpeak2
   pip install -r requirements.txt
   ```

2. **Quick start (Windows):**
   ```bash
   # Double-click or run:
   start_dev.bat
   ```

3. **Quick start (Any OS):**
   ```bash
   python dev_start.py
   ```

4. **Load Chrome Extension:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" 
   - Select the `app/frontend/dist_chrome` folder

5. **Test the System:**
   - Navigate to any LeetCode problem
   - Click the LeetSpeak extension icon
   - Start a voice chat session

### Manual Setup

### 1. Backend Setup

```bash
# Navigate to app directory
cd app

# Install Python dependencies
pip install -r requirements.txt

# Create .env file with your Azure credentials
cp .env.example .env
# Edit .env with your Azure Voice Live API credentials

# Start the backend server
python start_server.py
```

### 2. Chrome Extension Setup

```bash
# Navigate to frontend directory
cd app/frontend

# Install dependencies
npm install

# Build the extension
npm run build

# Load extension in Chrome:
# 1. Open Chrome and go to chrome://extensions/
# 2. Enable "Developer mode" (top right toggle)
# 3. Click "Load unpacked"
# 4. Select the dist_chrome folder
```

### 3. Configuration

#### Backend Configuration (.env file):
```bash
AZURE_VOICE_LIVE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_VOICE_LIVE_API_KEY=your-api-key-here
AZURE_VOICE_LIVE_API_VERSION=2025-05-01-preview
VOICE_LIVE_MODEL=gpt-4o-mini
```

#### Extension Configuration:
- Azure credentials can be entered in the extension UI (popup/panel)
- If left empty, uses backend .env configuration
- Supports multiple models: gpt-4o-mini, gpt-4o, gpt-4.1-nano

## Usage

1. **Start Backend**: Run `python start_server.py` in the app directory
2. **Open LeetCode**: Navigate to any LeetCode problem
3. **Open Extension**: Click the extension icon or open the side panel
4. **Start Voice Chat**: Click "Start Voice Chat" to begin your interview
5. **Code & Discuss**: Solve the problem while discussing your approach with the AI

## API Endpoints

### REST Endpoints
- `POST /api/sessions` - Create a new session
- `POST /api/sessions/{session_id}/start` - Start Azure connection
- `POST /api/sessions/{session_id}/stop` - Stop session
- `GET /api/sessions/{session_id}` - Get session info
- `GET /api/sessions` - List all sessions
- `GET /health` - Health check

### WebSocket Endpoints
- `ws://localhost:8000/ws/extension/{session_id}` - Extension communication
- `ws://localhost:8000/ws/scraping` - Content scraping data

## File Structure

```
app/
├── backend_server.py          # Main FastAPI server
├── start_server.py           # Server startup script
├── requirements.txt          # Python dependencies
├── .env                     # Environment configuration
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── popup/         # Extension popup
    │   │   ├── panel/         # Side panel interface
    │   │   └── content/       # Content scripts
    │   └── lib/
    │       └── voiceClient.js # Voice client library
    ├── public/
    │   └── audio-processor.js # Audio worklet
    ├── manifest.json         # Extension manifest
    └── package.json         # Node.js dependencies
```

## Development

### Backend Development
```bash
# Run server with auto-reload
python start_server.py

# View API documentation
http://localhost:8000/docs
```

### Frontend Development
```bash
cd frontend

# Watch mode for development
npm run dev

# Build for production
npm run build
```

### Testing
1. Start backend server: `python start_server.py`
2. Build and load extension in Chrome
3. Navigate to LeetCode problem
4. Test voice chat functionality
5. Verify real-time content scraping

## Troubleshooting

### Common Issues

**Backend not starting:**
- Check Python version (3.8+ required)
- Install dependencies: `pip install -r requirements.txt`
- Verify .env file configuration

**Extension not loading:**
- Build extension: `npm run build`
- Check Chrome extensions page for errors
- Verify manifest.json permissions

**Voice chat not working:**
- Check microphone permissions in Chrome
- Verify backend server is running on localhost:8000
- Check browser console for WebSocket connection errors

**Content scraping not working:**
- Navigate to a LeetCode problem page
- Check content script is injected (F12 Console)
- Verify WebSocket connection to scraping endpoint

### Logs and Debugging
- Backend logs: Check terminal output from `python start_server.py`
- Extension logs: Chrome DevTools → Extensions → LeetSpeak → Inspect views
- WebSocket connections: Network tab in DevTools

## Production Deployment

### Backend
- Use production WSGI server (gunicorn, uvicorn)
- Configure proper CORS origins
- Use HTTPS and WSS for WebSocket connections
- Set up proper authentication and rate limiting

### Extension
- Update manifest.json with production URLs
- Build with production configuration
- Submit to Chrome Web Store

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the existing architecture
4. Test thoroughly with backend and extension
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.