#!/usr/bin/env python3
"""
Test script to verify logging configuration
"""
import sys
import os
from pathlib import Path

# Add current directory to path to import endpoints
sys.path.append(str(Path(__file__).parent))

def test_logging():
    """Test the logging setup"""
    print("Testing logging configuration...")
    
    # Import the logger from endpoints (this will trigger the setup)
    from endpoints import logger
    
    # Test different log levels
    logger.info("🧪 Testing INFO level logging")
    logger.warning("⚠️ Testing WARNING level logging")
    logger.error("❌ Testing ERROR level logging")
    
    # Check if log files were created
    logs_dir = Path(__file__).parent / "logs"
    
    print(f"\n📁 Logs directory: {logs_dir}")
    print(f"Directory exists: {logs_dir.exists()}")
    
    if logs_dir.exists():
        log_files = list(logs_dir.glob("*.log"))
        print(f"Log files found: {len(log_files)}")
        for log_file in log_files:
            print(f"  - {log_file.name} ({log_file.stat().st_size} bytes)")
    else:
        print("❌ Logs directory does not exist")
    
    print("\n✅ Logging test completed!")

if __name__ == "__main__":
    test_logging()