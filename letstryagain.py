import asyncio
import base64
import os
from dotenv import load_dotenv
from hume.client import AsyncHumeClient
from hume.empathic_voice.chat.socket_client import ChatConnectOptions, ChatWebsocketConnection
from hume.empathic_voice.chat.types import SubscribeEvent
from hume.core.api_error import ApiError
from hume import Stream

from utils import send_packet_to_frontend


class WebSocketHandler:
    def __init__(self):
        # this is the connection between the python client and the actual Hume AI API
        # not our websocket to the frontend
        self.socket = None
        # this is where the audio output of HumeAI goes to and gets accumulated
        self.byte_strs = Stream.new()
        # Store the frontend connection (from the browser) here
        self.frontend_connection = None
        # this is for tracking state of the user typing
        self.editor_content = ""
        self.description = ""


    def set_socket(self, socket: ChatWebsocketConnection):
        self.socket = socket

    async def on_open(self):
        print("WebSocket connection opened.")

    async def on_message(self, message: SubscribeEvent):
        if message.type == "chat_metadata":
            message_type = message.type.upper()
            chat_id = message.chat_id
            chat_group_id = message.chat_group_id
            print(f"Chat initialized with ID: {message.chat_id}")
        elif message.type in ["user_message", "assistant_message"]: # this is simply the text
            role = message.message.role.upper()
            message_text = message.message.content
            # arbitrarily will update the code_context for hume ai when
            # people talk
            # random =
            if message.type == "user_message":
                await self.code_context()
            # if self.description=="":
            await self.description_context()
            print(f"{role}: {message_text}")
        elif message.type == "audio_output": # this is hume ai audio back to us
            message_str: str = message.data # this base64 wav file, NOT stream
            # this decodes the base64 back to bytes so it can be played
            message_bytes = base64.b64decode(message_str.encode("utf-8"))
            # now send this to the front end
            if self.frontend_connection:
                await send_packet_to_frontend(self.frontend_connection, message_bytes)
            else:
                print("No frontend connection available; skipping sending audio.")
            # then, this is stored in the stream for playback
            await self.byte_strs.put(message_bytes)
            return
        elif message.type == "error":
            error_message = message.message
            error_code = message.code
            raise ApiError()

    async def on_close(self):
        print("WebSocket connection closed.")

    async def on_error(self, error):
        print(f"WebSocket error: {error}")

    # this will send a packet of base64 embedded stream into hume ai
    async def send_audio(self, base64_audio):
        if not self.socket:
            print("Hume API connection not established yet. Dropping audio chunk.")
            return
        session_settings = {
            "type": "audio_input",
            "data": base64_audio,  # Change or remove base64 encoding if the API expects raw bytes.
        }
        try:
            await self.socket._send(session_settings)
            # print("Audio sent to Hume.")
        except Exception as e:
            print(f"Error sending audio: {e}")

    # Methods to accept scraped updates:
    async def handle_editor_update(self, content: str):
        self.editor_content = content
        print("hume_handler: Updated editor content.")

    async def handle_description_update(self, content: str):
        self.description = content
        print("hume_handler: Updated description.")

    async def code_context(self):
        print(f"code context updated to: {self.editor_content}")
        code_context = {
            "type": "session_settings",
            "context": {
                "text": self.editor_content,
                "type":"editable"
            }
        }

        if self.socket:
            # print(self.description)
            # await self.socket._send(description_context)
            await self.socket._send(code_context)
            #print('bottom')
        else:
            print("Socket is not set. Cannot send code context.")

    async def description_context(self):
        print(f"description context updated to: {self.description}")
        description_context = {
            "type": "session_settings",
            "variables": {
                "question": self.description,

            }
        }
        if self.socket:
            # print(self.description)
            await self.socket._send(description_context)
            #print('bottom')
        else:
            print("Socket is not set. Cannot send code context.")





async def hume_client(hume_handler: WebSocketHandler):
    """
    Connects to Hume AI and keeps the connection alive.
    """
    load_dotenv()
    HUME_API_KEY = os.getenv("HUME_API_KEY")
    HUME_SECRET_KEY = os.getenv("HUME_SECRET_KEY")
    HUME_CONFIG_ID = os.getenv("HUME_CONFIG_ID")

    client = AsyncHumeClient(api_key=HUME_API_KEY)
    options = ChatConnectOptions(config_id=HUME_CONFIG_ID, secret_key=HUME_SECRET_KEY)

    async with client.empathic_voice.chat.connect_with_callbacks(
            options=options,
            on_open=hume_handler.on_open,
            on_message=hume_handler.on_message,
            on_close=hume_handler.on_close,
            on_error=hume_handler.on_error
    ) as socket:
        hume_handler.set_socket(socket)
        # Keep the connection open indefinitely
        await asyncio.Future()
