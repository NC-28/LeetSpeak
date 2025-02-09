# scrape_server.py
import asyncio
import websockets
import json

async def handler(websocket, path, hume_handler):
    print("scrape handler called")
    async for message in websocket:
        data = json.loads(message)
        if data["type"] == "editor_update":
            print("\n[Editor Update]\n", data["content"])
            # Pass the update to the shared hume_handler
            hume_handler.handle_editor_update(data["content"])
        elif data["type"] == "description_update":
            print("\n[Description Update]\n", data["content"])
            hume_handler.handle_description_update(data["content"])


async def scrape_server(hume_handler):
    async with websockets.serve(lambda ws, path: handler(ws, path, hume_handler), "localhost", 8765):
        print("Scrape WebSocket Server Running on ws://localhost:8765")
        await asyncio.Future()  # Run forever
