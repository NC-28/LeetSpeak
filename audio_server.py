import asyncio
import websockets
import base64
from letstryagain import WebSocketHandler, hume_client

async def ws_handler(connection: websockets, path, hume_handler):
    """

    :param connection: this is the websocket that connects from Chrome to here, connection to mic
    :param path: not really used
    :param hume_handler: this
    :return:
    """
    # this causes getting the audio from the background
    # set this so it can be referenced later
    hume_handler.frontend_connection = connection

    async for message in connection:
        if isinstance(message, bytes):
            # Convert binary audio to base64
            base64_audio = base64.b64encode(message).decode('utf-8')
            print(f"Base64 Audio (trimmed): {base64_audio[:50]}...")
            print(f"Received audio ({len(message)} bytes). Forwarding to Hume...")
            # then directly send the audio to the backend
            await hume_handler.send_audio(base64_audio)
        else:
            print(f"Received text: {message}")

async def audio_server(hume_handler):
    # Use a lambda to pass the hume_handler into the websocket handler
    async with websockets.serve(lambda ws, path: ws_handler(ws, path, hume_handler), "localhost", 8080):
        print("Audio server running on ws://localhost:8080")
        await asyncio.Future()  # Run forever

async def main():
    hume_handler = WebSocketHandler()
    # Run both the Hume client and the audio server concurrently
    await asyncio.gather(
        hume_client(hume_handler),
        audio_server(hume_handler)
    )

if __name__ == "__main__":
    asyncio.run(main())