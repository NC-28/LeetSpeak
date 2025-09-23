"""
Azure Voice Live API Client Integration
Handles WebSocket connections and message processing with Azure
"""
import asyncio
import json
import logging
import uuid
from typing import Optional
import websockets

logger = logging.getLogger(__name__)


class VoiceLiveConnection:
    def __init__(self, url: str, headers: dict) -> None:
        self._url = url
        self._headers = headers
        self._ws = None
        self._message_queue = asyncio.Queue()
        self._connected = False

    async def connect(self) -> None:
        try:
            self._ws = await websockets.connect(self._url, extra_headers=self._headers)
            self._connected = True
            logger.info("Azure WebSocket connection established")
        except Exception as e:
            logger.error(f"Azure connection failed: {e}")
            raise

    async def recv(self) -> Optional[str]:
        try:
            if self._ws:
                message = await self._ws.recv()
                return message
        except websockets.exceptions.ConnectionClosed:
            self._connected = False
        except Exception as e:
            logger.error(f"Error receiving message: {e}")
        return None

    async def send(self, message: str) -> None:
        if self._ws and self._connected:
            await self._ws.send(message)

    async def close(self) -> None:
        if self._ws:
            await self._ws.close()
            self._connected = False


class AzureVoiceLive:
    def __init__(self, azure_endpoint: str, api_version: str, token: str = None, api_key: str = None):
        self._azure_endpoint = azure_endpoint
        self._api_version = api_version
        self._token = token
        self._api_key = api_key
        self._connection = None

    async def connect(self, model: str) -> VoiceLiveConnection:
        if not model:
            raise ValueError("Model name is required.")

        azure_ws_endpoint = self._azure_endpoint.rstrip('/').replace("https://", "wss://")
        url = f"{azure_ws_endpoint}/voice-live/realtime?api-version={self._api_version}&model={model}"

        auth_header = {"Authorization": f"Bearer {self._token}"} if self._token else {"api-key": self._api_key}
        request_id = uuid.uuid4()
        headers = {"x-ms-client-request-id": str(request_id), **auth_header}

        self._connection = VoiceLiveConnection(url, headers)
        await self._connection.connect()
        return self._connection


async def send_session_configuration(connection: VoiceLiveConnection, session_id: str, scraping_data: dict, context: dict = None):
    """Send session configuration to Azure Voice Live API"""
    # Get current scraping data
    title = scraping_data.get("title", "")
    description = scraping_data.get("description", "")
    editor = scraping_data.get("editor", "") or scraping_data.get("code", "")
    
    logger.info(f"Configuring AI session {session_id[:8]} - Title: '{title}' | Description: {len(description)}chars | Code: {len(editor)}chars")
    
    # Build context information - prioritize scraped data over context parameter
    context_info = ""
    current_title = title or (context.get('title') if context else "")
    current_description = description or (context.get('description') if context else "")
    current_code = editor or (context.get('code') if context else "")
    
    if current_title:
        context_info += f"\n\n**Current Problem**: {current_title}"
    if current_description:
        context_info += f"\n\n**Problem Description**: {current_description}"
    if current_code:
        context_info += f"\n\n**Current Code**: \n```\n{current_code}\n```"
    if context and context.get("testCases"):
        context_info += f"\n\n**Test Cases**: {context['testCases']}"

    instructions = f"""
You are NOT an assistant, tutor, or collaborator.  
You are an AI Technical Interviewer for a high-stakes coding interview (LeetCode-style).  
Act like a real interviewer: professional, concise, and evaluative.  
Speak as if you are on a live voice call.  

The candidate can already see the full problem and their code on screen.  
The system will provide two reference variables ONCE at the start:  
{current_title} = the name/title of the problem
{current_description} = the problem statement  
{current_code} = the candidate's current code in their editor 

Rules for variables:  
• Use them only as context. Never repeat or output them verbatim.  
• Refer indirectly in plain language or pseudocode.  
  - Example: `len(nums)` → "the length of nums."  
  - Example: `for i in range(len(nums))` → "loop through the indices of nums."  
  - Example: `nums[i] + nums[j]` → "sum of element i and element j."  

--- Interview Flow ---
1. **Opening**  
   - Start direct: "Walk me through your approach."  

2. **During Live Coding**  
   - React concisely to changes in the candidate's current code.  
   - Acknowledge progress in plain language.  
   - Ask focused questions only tied to what they say or write.  

3. **If Stuck**  
   - Give short nudges, never full strategies.  
   - Example: "Could that be done without scanning twice?"  

4. **Validation & Edge Cases**  
   - Challenge directly: "What happens if the array is empty?"  
   - "Walk through your code with a small example."  

5. **Optimization**  
   - Push briefly once solution works:  
     "What's the complexity?"  
     "Can you do better in linear time?"  

6. **Follow-Ups**  
   - Short variations: "How would this change if input was sorted?"  

7. **Wrap-Up (ONLY when candidate says 'I am finished')**  
   - Give concise feedback:  
     • Strengths.  
     • Weaknesses.  
     • One improvement.  

--- Tone & Style ---
• Always concise — 1-2 sentences max.  
• End turns with a clear question.  
• Stay evaluative, never explanatory.  
• Refer to code only as pseudocode/intent, not syntax.  
• Maintain realistic interview pressure.  
• Never provide full solutions.  
• Do not end until the candidate explicitly says they are finished.  

"""

    session_update = {
        "type": "session.update",
        "session": {
            "instructions": instructions,
            "input_audio_transcription": {"model": "whisper-1", "language": "en"},
            "turn_detection": {
                "type": "azure_semantic_vad",
                "threshold": 0.2,
                "prefix_padding_ms": 200,
                "silence_duration_ms": 200,
                "remove_filler_words": True,
                "end_of_utterance_detection": {
                    "model": "semantic_detection_v1",
                    "threshold": 0.005,
                    "timeout": 1,
                },
            },
            "input_audio_noise_reduction": {"type": "azure_deep_noise_suppression"},
            "input_audio_echo_cancellation": {"type": "server_echo_cancellation"},
            "voice": {
                "name": "en-US-Ava:DragonHDLatestNeural",
                "type": "azure-standard",
                "temperature": 0.7,
                "rate": "1.4",
            },
        },
        "event_id": ""
    }
    
    await connection.send(json.dumps(session_update))
    logger.info(f"Session configuration sent for {session_id[:8]}")


async def send_context_update_to_azure(connection, context_type: str, content: str, session_id: str):
    """Send real-time context updates to Azure session"""
    try:
        cleaned_content = content.replace('\u00a0', ' ').replace('\xa0', ' ').strip()
        logger.info(f"Sending {context_type} update to {session_id[:8]} ({len(cleaned_content)} chars)")
        
        context_update_text = f"[{context_type.upper()} UPDATE] {cleaned_content[:1500]}{'...' if len(cleaned_content) > 1500 else ''}"
        
        context_message = {
            "type": "session.update",
            "session": {
                "instructions": f"REAL-TIME UPDATE: User updated their {context_type}. Current {context_type}: {context_update_text}. Acknowledge briefly and provide relevant guidance."
            }
        }
        
        await connection.send(json.dumps(context_message))
        logger.info(f"Context update sent to {session_id[:8]}")
        
    except Exception as e:
        logger.error(f"Failed to send context update: {e}")



async def send_text_message(connection: VoiceLiveConnection, text: str, session_id: str = None):
    """Send a text message that will be processed and responded to with audio"""
    try:
        # Create a conversation item with text content
        text_message = {
            "type": "conversation.item.create",
            "item": {
                "id": f"msg_{uuid.uuid4()}",
                "type": "message",
                "role": "user",
                "content": [
                    {
                        "type": "input_text", 
                        "text": text
                    }
                ]
            }
        }
        
        await connection.send(json.dumps(text_message))
        
        # Trigger a response that will be converted to audio
        response_create = {
            "type": "response.create",
            "response": {
                "modalities": ["audio"],  # This ensures audio output
                "instructions": "Respond as the technical interviewer. Keep it concise."
            }
        }
        
        await connection.send(json.dumps(response_create))
        
        logger.info(f"Text message sent to session {session_id[:8] if session_id else 'unknown'}: {text[:100]}{'...' if len(text) > 100 else ''}")
        
    except Exception as e:
        logger.error(f"Failed to send text message: {e}")
        raise


async def trigger_session_evaluation(connection: VoiceLiveConnection, session_id: str, final_code: str = "", session_duration: str = "", scraping_data: dict = None):
    """Trigger comprehensive evaluation at the end of the interview session"""
    try:
        # Get additional context from scraping data if available
        problem_title = ""
        problem_description = ""
        if scraping_data:
            problem_title = scraping_data.get("title", "")
            problem_description = scraping_data.get("description", "")
        
        # Prepare the final code section to avoid f-string backslash issues
        final_code_section = ""
        if final_code:
            truncated_code = final_code[:1000]
            if len(final_code) > 1000:
                truncated_code += "..."
            final_code_section = f"FINAL CODE SOLUTION:\n{truncated_code}"
        
        evaluation_prompt = f"""
INTERVIEW EVALUATION:

Please provide a comprehensive evaluation of this coding interview session.

Session: {problem_title if problem_title else 'LeetCode Problem'} | Duration: {session_duration if session_duration else 'Completed'}

{final_code_section}

Evaluate:
1. Problem-solving approach and methodology
2. Code quality, structure, and correctness  
3. Communication and explanation skills
4. Technical understanding (complexity, edge cases)
5. Overall strengths and improvement areas

Provide specific feedback and an overall rating. Keep response concise but thorough.
        """
        
        await send_text_message(connection, evaluation_prompt.strip(), session_id)
        
        # Give time for the evaluation response to be processed and sent
        await asyncio.sleep(8)
        
        logger.info(f"Session evaluation completed for {session_id[:8]}")
        
    except Exception as e:
        logger.error(f"Failed to trigger evaluation for session {session_id}: {e}")
        raise