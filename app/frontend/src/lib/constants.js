/**
 * Constants for LeetSpeak Voice Client
 */

export const AUDIO_CONFIG = {
    SAMPLE_RATE: 24000,
    BUFFER_SIZE: 1200,
    CHANNEL_COUNT: 1,
    PCM_CONVERSION_FACTOR: 32768.0
};

export const TIMING_CONFIG = {
    BARGE_IN_COOLDOWN_MS: 1200
};

export const API_ENDPOINTS = {
    SESSIONS: '/api/sessions',
    START_SESSION: '/api/sessions/{sessionId}/start',
    STOP_SESSION: '/api/sessions/{sessionId}/stop',
    WEBSOCKET: '/ws/extension/{sessionId}'
};

export const MESSAGE_TYPES = {
    // Session events
    SESSION_CREATED: 'session.created',
    
    // Audio events
    SPEECH_STARTED: 'input_audio_buffer.speech_started',
    AUDIO_DELTA: 'response.audio.delta',
    AUDIO_DONE: 'response.audio.done',
    
    // Response events
    RESPONSE_CREATED: 'response.created',
    RESPONSE_AUDIO_TRANSCRIPT_DELTA: 'response.audio_transcript.delta',
    RESPONSE_AUDIO_TRANSCRIPT_DONE: 'response.audio_transcript.done',
    
    // Transcript events
    INPUT_AUDIO_TRANSCRIPTION_COMPLETED: 'conversation.item.input_audio_transcription.completed',
    
    // Error events
    ERROR: 'error'
};

export const CONNECTION_STATES = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    SESSION_ACTIVE: 'sessionActive',
    SESSION_STOPPED: 'sessionStopped',
    DISCONNECTED: 'disconnected',
    DISCONNECTING: 'disconnecting',
    ERROR: 'error'
};

export const EXTENSION_ACTIONS = {
    START_VOICE_CHAT: 'startVoiceChat',
    STOP_VOICE_CHAT: 'stopVoiceChat',
    GET_SESSION_STATUS: 'getSessionStatus',
    GET_LEETCODE_DATA: 'getLeetCodeData',
    VOICE_CONNECTION_STATE_CHANGED: 'voiceConnectionStateChanged'
};

export const LEETCODE_URLS = [
    '*://leetcode.com/*',
    '*://*.leetcode.com/*',
    '*://leetcode.cn/*',
    '*://*.leetcode.cn/*'
];

export const DEFAULT_CONFIG = {
    BACKEND_URL: 'http://localhost:8000',
    WEBSOCKET_URL: 'ws://localhost:8000',
    MODEL: 'gpt-4o-mini'
};