import asyncio
import websockets
import json

# Store latest data
latest_editor_content = ""
latest_description = ""

async def handler(websocket, path):
    global latest_editor_content, latest_description

    async for message in websocket:
        data = json.loads(message)
        if data["type"] == "editor_update":
            latest_editor_content = data["content"]
            print("\n[Editor Update]\n", latest_editor_content)
        elif data["type"] == "description_update":
            latest_description = data["content"]
            print("\n[Description Update]\n", latest_description)

# Start WebSocket server
async def main():
    async with websockets.serve(handler, "localhost", 8765):
        print("WebSocket Server Running on ws://localhost:8765")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())
