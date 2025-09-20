#!/usr/bin/env python3
"""
Simple HTTP server for Azure Voice Live web frontend
Run this to serve the HTML/JS files locally
"""

import http.server
import socketserver
import webbrowser
import os
import sys
from pathlib import Path

def main():
    # Change to the directory containing this script
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    PORT = 8000
    
    class CustomHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            # Add CORS headers for local development
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', '*')
            # Required for audio worklets
            self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
            self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
            super().end_headers()
    
    try:
        with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
            print(f"🌐 Azure Voice Live Web Frontend")
            print(f"📡 Server running at http://localhost:{PORT}")
            print(f"📁 Serving files from: {script_dir}")
            print(f"🔗 Opening browser...")
            print(f"📝 Press Ctrl+C to stop the server")
            print()
            
            # Open browser automatically
            webbrowser.open(f'http://localhost:{PORT}')
            
            print("🎤 Ready to use Azure Voice Live Chat!")
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n👋 Server stopped.")
    except OSError as e:
        if e.errno == 48:  # Port already in use
            print(f"❌ Port {PORT} is already in use.")
            print(f"💡 Try a different port or stop the existing server.")
        else:
            print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
