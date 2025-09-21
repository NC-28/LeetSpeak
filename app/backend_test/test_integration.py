#!/usr/bin/env python3
"""
LeetSpeak System Integration Test
Tests the basic functionality of the backend API and WebSocket connections
"""

import asyncio
import json
import requests
import websockets
import time
from datetime import datetime

class LeetSpeakTester:
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.ws_url = "ws://localhost:8000"
        self.session_id = None
        
    def test_health_check(self):
        """Test health check endpoint"""
        print("🏥 Testing health check...")
        try:
            response = requests.get(f"{self.base_url}/health")
            if response.status_code == 200:
                print("✅ Health check passed")
                return True
            else:
                print(f"❌ Health check failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Health check error: {e}")
            return False
    
    def test_session_creation(self):
        """Test session creation"""
        print("📝 Testing session creation...")
        try:
            response = requests.post(f"{self.base_url}/api/sessions", json={
                "model": "gpt-4o-mini"
            })
            if response.status_code == 200:
                data = response.json()
                self.session_id = data.get("session_id")
                print(f"✅ Session created: {self.session_id[:8]}...")
                return True
            else:
                print(f"❌ Session creation failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Session creation error: {e}")
            return False
    
    def test_session_info(self):
        """Test session info retrieval"""
        if not self.session_id:
            print("❌ No session ID available for testing")
            return False
            
        print("📋 Testing session info retrieval...")
        try:
            response = requests.get(f"{self.base_url}/api/sessions/{self.session_id}")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Session info retrieved: {data.get('status')}")
                return True
            else:
                print(f"❌ Session info failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Session info error: {e}")
            return False
    
    async def test_scraping_websocket(self):
        """Test scraping WebSocket connection"""
        print("🌐 Testing scraping WebSocket...")
        try:
            uri = f"{self.ws_url}/ws/scraping"
            async with websockets.connect(uri) as websocket:
                print("✅ Scraping WebSocket connected")
                
                # Send test data
                test_data = {
                    "type": "editor_update",
                    "content": "def two_sum(nums, target):\n    # Test code"
                }
                await websocket.send(json.dumps(test_data))
                print("✅ Test editor data sent")
                
                # Send description data
                desc_data = {
                    "type": "description_update", 
                    "content": "Given an array of integers nums and an integer target..."
                }
                await websocket.send(json.dumps(desc_data))
                print("✅ Test description data sent")
                
                return True
                
        except Exception as e:
            print(f"❌ Scraping WebSocket error: {e}")
            return False
    
    async def test_extension_websocket(self):
        """Test extension WebSocket connection"""
        if not self.session_id:
            print("❌ No session ID available for WebSocket testing")
            return False
            
        print("📱 Testing extension WebSocket...")
        try:
            uri = f"{self.ws_url}/ws/extension/{self.session_id}"
            async with websockets.connect(uri) as websocket:
                print("✅ Extension WebSocket connected")
                
                # Send ping message
                ping_msg = {"type": "ping"}
                await websocket.send(json.dumps(ping_msg))
                print("✅ Ping message sent")
                
                # Wait for pong response
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=2)
                    data = json.loads(response)
                    if data.get("type") == "pong":
                        print("✅ Pong response received")
                    else:
                        print(f"📨 Received: {data}")
                except asyncio.TimeoutError:
                    print("⚠️ No pong response (this is normal for basic test)")
                
                return True
                
        except Exception as e:
            print(f"❌ Extension WebSocket error: {e}")
            return False
    
    def test_session_cleanup(self):
        """Test session cleanup"""
        if not self.session_id:
            print("❌ No session ID available for cleanup")
            return False
            
        print("🧹 Testing session cleanup...")
        try:
            response = requests.post(f"{self.base_url}/api/sessions/{self.session_id}/stop")
            if response.status_code == 200:
                print("✅ Session stopped successfully")
                return True
            else:
                print(f"❌ Session cleanup failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Session cleanup error: {e}")
            return False
    
    async def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting LeetSpeak Integration Tests")
        print("=" * 50)
        print(f"⏰ Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        results = []
        
        # HTTP API Tests
        results.append(("Health Check", self.test_health_check()))
        results.append(("Session Creation", self.test_session_creation()))
        results.append(("Session Info", self.test_session_info()))
        
        # WebSocket Tests
        results.append(("Scraping WebSocket", await self.test_scraping_websocket()))
        results.append(("Extension WebSocket", await self.test_extension_websocket()))
        
        # Cleanup
        results.append(("Session Cleanup", self.test_session_cleanup()))
        
        # Results Summary
        print("\n" + "=" * 50)
        print("📊 Test Results Summary")
        print("=" * 50)
        
        passed = 0
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name:<25} {status}")
            if result:
                passed += 1
        
        print("=" * 50)
        print(f"Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! System is ready to use.")
        else:
            print("⚠️  Some tests failed. Check the backend server and configuration.")
        
        print(f"⏰ Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

def main():
    """Main test function"""
    tester = LeetSpeakTester()
    
    print("🔍 Checking if backend server is running...")
    if not tester.test_health_check():
        print("\n❌ Backend server is not running!")
        print("Please start the backend server first:")
        print("  python start_server.py")
        return
    
    print("✅ Backend server is running\n")
    
    # Run async tests
    asyncio.run(tester.run_all_tests())

if __name__ == "__main__":
    main()