#!/usr/bin/env python3
"""
LeetSpeak Voice Extension Startup Script
Comprehensive startup script for development and testing.
"""

import asyncio
import logging
import os
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class LeetSpeakStarter:
    """Comprehensive startup manager for LeetSpeak development environment."""
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.backend_dir = self.project_root / "app"
        self.frontend_dir = self.project_root / "app" / "frontend"
        self.backend_process: Optional[subprocess.Popen] = None
        self.frontend_process: Optional[subprocess.Popen] = None
    
    def check_dependencies(self) -> bool:
        """Check if required dependencies are installed."""
        logger.info("Checking dependencies...")
        
        # Check Python dependencies
        try:
            import fastapi
            import uvicorn
            import websockets
            import azure.cognitiveservices.speech
            logger.info("✓ Python dependencies found")
        except ImportError as e:
            logger.error(f"✗ Missing Python dependency: {e}")
            logger.info("Run: pip install -r requirements.txt")
            return False
        
        # Check Node.js
        try:
            result = subprocess.run(["node", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                logger.info(f"✓ Node.js found: {result.stdout.strip()}")
            else:
                logger.error("✗ Node.js not found")
                return False
        except FileNotFoundError:
            logger.error("✗ Node.js not found in PATH")
            return False
        
        # Check npm
        try:
            result = subprocess.run(["npm", "--version"], capture_output=True, text=True)
            if result.returncode == 0:
                logger.info(f"✓ npm found: {result.stdout.strip()}")
            else:
                logger.error("✗ npm not found")
                return False
        except FileNotFoundError:
            logger.error("✗ npm not found in PATH")
            return False
        
        return True
    
    def setup_environment(self) -> bool:
        """Set up the development environment."""
        logger.info("Setting up environment...")
        
        # Check for .env file
        env_file = self.project_root / ".env"
        if not env_file.exists():
            logger.warning("⚠ .env file not found")
            logger.info("Creating sample .env file...")
            
            env_content = """# Azure Speech Service Configuration
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=your_azure_region_here

# Backend Configuration
BACKEND_HOST=localhost
BACKEND_PORT=8000
BACKEND_DEBUG=true

# Frontend Configuration
FRONTEND_PORT=5173
"""
            with open(env_file, 'w') as f:
                f.write(env_content)
            
            logger.info(f"Please edit {env_file} with your Azure credentials")
            return False
        
        # Install frontend dependencies if needed
        node_modules = self.frontend_dir / "node_modules"
        if not node_modules.exists():
            logger.info("Installing frontend dependencies...")
            try:
                subprocess.run(
                    ["npm", "install"],
                    cwd=self.frontend_dir,
                    check=True
                )
                logger.info("✓ Frontend dependencies installed")
            except subprocess.CalledProcessError:
                logger.error("✗ Failed to install frontend dependencies")
                return False
        
        return True
    
    def start_backend(self) -> bool:
        """Start the FastAPI backend server."""
        logger.info("Starting backend server...")
        
        try:
            # Use the backend_server.py directly
            backend_script = self.backend_dir / "backend_server.py"
            if not backend_script.exists():
                logger.error(f"Backend script not found: {backend_script}")
                return False
            
            self.backend_process = subprocess.Popen(
                [sys.executable, str(backend_script)],
                cwd=self.backend_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            # Wait a moment for server to start
            time.sleep(2)
            
            if self.backend_process.poll() is None:
                logger.info("✓ Backend server started (PID: {})".format(self.backend_process.pid))
                return True
            else:
                logger.error("✗ Backend server failed to start")
                return False
                
        except Exception as e:
            logger.error(f"✗ Failed to start backend: {e}")
            return False
    
    def build_extension(self) -> bool:
        """Build the Chrome extension."""
        logger.info("Building Chrome extension...")
        
        try:
            subprocess.run(
                ["npm", "run", "build"],
                cwd=self.frontend_dir,
                check=True
            )
            logger.info("✓ Chrome extension built successfully")
            
            # Check if dist directory exists
            dist_dir = self.frontend_dir / "dist_chrome"
            if dist_dir.exists():
                logger.info(f"Extension files available in: {dist_dir}")
                return True
            else:
                logger.warning("⚠ dist_chrome directory not found after build")
                return False
                
        except subprocess.CalledProcessError as e:
            logger.error(f"✗ Failed to build extension: {e}")
            return False
    
    def test_system(self) -> bool:
        """Run system tests."""
        logger.info("Running system tests...")
        
        try:
            test_script = self.project_root / "test_integration.py"
            if not test_script.exists():
                logger.warning("⚠ Integration test script not found")
                return True  # Not critical
            
            result = subprocess.run(
                [sys.executable, str(test_script)],
                cwd=self.project_root,
                timeout=30
            )
            
            if result.returncode == 0:
                logger.info("✓ System tests passed")
                return True
            else:
                logger.warning("⚠ System tests failed (non-critical)")
                return True  # Non-critical for startup
                
        except subprocess.TimeoutExpired:
            logger.warning("⚠ System tests timed out")
            return True
        except Exception as e:
            logger.warning(f"⚠ System test error: {e}")
            return True
    
    def open_development_urls(self):
        """Open relevant URLs for development."""
        urls = [
            "http://localhost:8000/docs",  # FastAPI docs
            "chrome://extensions/",        # Chrome extensions page
            "https://leetcode.com/problems/two-sum/"  # Sample LeetCode page
        ]
        
        logger.info("Opening development URLs...")
        for url in urls:
            try:
                webbrowser.open(url)
            except Exception as e:
                logger.warning(f"Failed to open {url}: {e}")
    
    def show_instructions(self):
        """Show post-startup instructions."""
        instructions = """
╔═══════════════════════════════════════════════════════════════════════════════╗
║                          LeetSpeak Development Ready!                         ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Next Steps:                                                                  ║
║                                                                               ║
║  1. Load Chrome Extension:                                                    ║
║     • Open Chrome and go to chrome://extensions/                             ║
║     • Enable "Developer mode" (top right toggle)                             ║
║     • Click "Load unpacked"                                                   ║
║     • Select: app/frontend/dist_chrome folder                                ║
║                                                                               ║
║  2. Test the Extension:                                                       ║
║     • Navigate to any LeetCode problem page                                   ║
║     • Click the LeetSpeak extension icon                                      ║
║     • Start a voice chat session                                             ║
║                                                                               ║
║  3. Development URLs:                                                         ║
║     • Backend API: http://localhost:8000                                      ║
║     • API Docs: http://localhost:8000/docs                                    ║
║     • Health Check: http://localhost:8000/health                             ║
║                                                                               ║
║  4. Logs and Debugging:                                                       ║
║     • Backend logs: Check terminal output                                     ║
║     • Extension logs: Chrome DevTools > Console                              ║
║     • Voice logs: app/logs/ directory                                        ║
║                                                                               ║
║  Press Ctrl+C to stop all services                                           ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
"""
        print(instructions)
    
    def cleanup(self):
        """Clean up processes on exit."""
        logger.info("Cleaning up...")
        
        if self.backend_process:
            logger.info("Stopping backend server...")
            self.backend_process.terminate()
            try:
                self.backend_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.backend_process.kill()
    
    async def run(self):
        """Main startup sequence."""
        logger.info("🚀 Starting LeetSpeak Voice Extension Development Environment")
        
        try:
            # Step 1: Check dependencies
            if not self.check_dependencies():
                logger.error("❌ Dependency check failed")
                return False
            
            # Step 2: Setup environment
            if not self.setup_environment():
                logger.error("❌ Environment setup failed")
                return False
            
            # Step 3: Start backend
            if not self.start_backend():
                logger.error("❌ Backend startup failed")
                return False
            
            # Step 4: Build extension
            if not self.build_extension():
                logger.error("❌ Extension build failed")
                return False
            
            # Step 5: Test system
            self.test_system()
            
            # Step 6: Open development URLs
            self.open_development_urls()
            
            # Step 7: Show instructions
            self.show_instructions()
            
            # Step 8: Keep running
            logger.info("✅ All services started successfully!")
            logger.info("Press Ctrl+C to stop all services...")
            
            # Keep the script running
            try:
                while True:
                    await asyncio.sleep(1)
                    
                    # Check if backend is still running
                    if self.backend_process and self.backend_process.poll() is not None:
                        logger.error("Backend process died unexpectedly")
                        break
                        
            except KeyboardInterrupt:
                logger.info("Received interrupt signal")
            
            return True
            
        finally:
            self.cleanup()

def main():
    """Main entry point."""
    starter = LeetSpeakStarter()
    
    try:
        asyncio.run(starter.run())
    except KeyboardInterrupt:
        logger.info("Startup cancelled by user")
    except Exception as e:
        logger.error(f"Startup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()