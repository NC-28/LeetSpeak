/**
 * LeetSpeak Voice Client for Chrome Extension
 * Handles voice chat functionality integrated with FastAPI backend
 */

import { AudioManager } from './AudioManager.js';
import { WebSocketManager } from './WebSocketManager.js';
import { SessionManager } from './SessionManager.js';
import { TranscriptManager } from './TranscriptManager.js';
import { ChromeExtensionBridge } from './ChromeExtensionBridge.js';
import { CONNECTION_STATES, MESSAGE_TYPES, DEFAULT_CONFIG } from './constants.js';

class LeetSpeakVoiceClient {
    constructor() {
        // Core state
        this.isConnected = false;
        this.isIntentionallyStopping = false;
        
        // Initialize managers
        this.audioManager = new AudioManager(this.handleAudioData.bind(this));
        this.sessionManager = new SessionManager(DEFAULT_CONFIG.BACKEND_URL);
        this.webSocketManager = new WebSocketManager(
            DEFAULT_CONFIG.WEBSOCKET_URL,
            this.handleBackendMessage.bind(this),
            this.handleConnectionChange.bind(this)
        );
        this.transcriptManager = new TranscriptManager(
            this.addMessage.bind(this),
            this.onTranscript
        );
        this.extensionBridge = new ChromeExtensionBridge(
            this.startVoiceChat.bind(this),
            this.stopVoiceChat.bind(this),
            this.getSessionStatus.bind(this)
        );
        
        // Event callbacks
        this.onStatusChange = null;
        this.onMessage = null;
        this.onTranscript = null;
        this.onError = null;
    }
    
    /**
     * Handle audio data from AudioManager
     */
    handleAudioData(base64Audio) {
        if (this.webSocketManager.isWebSocketConnected()) {
            this.webSocketManager.sendAudioData(base64Audio);
        }
    }

    /**
     * Handle connection state changes
     */
    handleConnectionChange(state) {
        this.isConnected = state === CONNECTION_STATES.CONNECTED;
        this.extensionBridge.broadcastConnectionState(
            state, 
            this.sessionManager.sessionId, 
            this.isConnected, 
            this.sessionManager.sessionActive
        );
    }

    /**
     * Get session status for extension bridge
     */
    getSessionStatus() {
        return {
            sessionId: this.sessionManager.sessionId,
            isConnected: this.isConnected,
            sessionActive: this.sessionManager.sessionActive
        };
    }
    
    async startVoiceChat(config = {}) {
        try {
            this.updateStatus(CONNECTION_STATES.CONNECTING, 'Starting voice chat session...');
            
            // Create session
            const sessionResponse = await this.sessionManager.createSession(config.model);
            
            // Initialize audio
            await this.audioManager.initialize();
            
            // Connect to backend WebSocket
            await this.webSocketManager.connect(this.sessionManager.sessionId);
            
            // Get LeetCode context and start the session
            const context = await this.extensionBridge.getLeetCodeContext();
            await this.sessionManager.startSession(config, context);
            
            this.extensionBridge.broadcastConnectionState(
                CONNECTION_STATES.SESSION_ACTIVE,
                this.sessionManager.sessionId,
                this.isConnected,
                this.sessionManager.sessionActive
            );
            this.updateStatus(CONNECTION_STATES.CONNECTED, 'Voice chat active');
            
            return { 
                sessionId: this.sessionManager.sessionId, 
                status: 'active' 
            };
            
        } catch (error) {
            this.updateStatus(CONNECTION_STATES.ERROR, `Failed to start: ${error.message}`);
            throw error;
        }
    }
    
    async stopVoiceChat() {
        try {
            this.updateStatus(CONNECTION_STATES.DISCONNECTING, 'Stopping voice chat...');
            
            // Mark that we're intentionally stopping
            this.isIntentionallyStopping = true;
            
            // Stop audio recording and playback
            this.audioManager.stopAll();
            
            // Stop backend session FIRST (this triggers evaluation and waits for completion)
            await this.sessionManager.stopSession();
            
            // Backend now waits for actual completion, so we can disconnect immediately
            this.webSocketManager.disconnect();
            
            this.isConnected = false;
            this.transcriptManager.reset();
            
            // Add a small delay before broadcasting to ensure message channels are stable
            setTimeout(async () => {
                await this.extensionBridge.broadcastConnectionState(CONNECTION_STATES.SESSION_STOPPED);
            }, 50);
            
            this.updateStatus(CONNECTION_STATES.DISCONNECTED, 'Voice chat stopped');
            
            // Reset the flag after a short delay
            setTimeout(() => {
                this.isIntentionallyStopping = false;
            }, 100);
            
            return { status: 'stopped' };
            
        } catch (error) {
            this.isIntentionallyStopping = false;
            this.updateStatus(CONNECTION_STATES.ERROR, `Error stopping: ${error.message}`);
            throw error;
        }
    }
    

    
    handleBackendMessage(event) {
        const eventType = event.type;
        
        switch (eventType) {
            case MESSAGE_TYPES.SESSION_CREATED:
                console.log('✅ Azure session created');
                break;
                
            case MESSAGE_TYPES.SPEECH_STARTED:
                if (this.transcriptManager.handleSpeechStarted()) {
                    this.interruptForUserSpeech();
                }
                break;
                
            case MESSAGE_TYPES.RESPONSE_CREATED:
                this.transcriptManager.startResponse(
                    (event.response && event.response.id) || event.response_id || event.item_id
                );
                this.audioManager.clearQueues();
                break;
                
            case MESSAGE_TYPES.INPUT_AUDIO_TRANSCRIPTION_COMPLETED:
                this.transcriptManager.handleUserTranscript(event.transcript);
                break;
                
            case MESSAGE_TYPES.RESPONSE_AUDIO_TRANSCRIPT_DELTA:
                this.transcriptManager.handleResponseDelta(
                    event.delta, 
                    event.response_id || event.item_id
                );
                break;
                
            case MESSAGE_TYPES.RESPONSE_AUDIO_TRANSCRIPT_DONE:
                this.transcriptManager.handleResponseComplete(
                    event.response_id || event.item_id
                );
                break;
                
            case MESSAGE_TYPES.AUDIO_DELTA:
                if (!this.transcriptManager.shouldCancelResponse(event.response_id)) {
                    this.audioManager.addAudioChunk(event.delta);
                }
                break;
                
            case MESSAGE_TYPES.AUDIO_DONE:
                this.audioManager.finalizeAudio();
                break;
                
            case MESSAGE_TYPES.ERROR:
                const error = event.error || {};
                const msg = error.message || error.code || 'Unknown error';
                this.addMessage('System', `Error: ${msg}`, 'system');
                this.onError?.(new Error(msg));
                break;
        }
    }
    
    interruptForUserSpeech() {
        try {
            this.audioManager.interrupt();
            
            const responseId = this.transcriptManager.activeResponseId;
            if (responseId && this.transcriptManager.cancelResponse(responseId)) {
                this.webSocketManager.cancelResponse(responseId);
            }
        } catch (e) {
            console.error('Error during interruption:', e);
        }
    }
    
    handleDisconnection() {
        if (this.sessionManager.sessionActive && !this.isIntentionallyStopping) {
            this.stopVoiceChat();
            this.onError?.(new Error('Connection lost. Please try again.'));
        }
    }
    
    // Utility functions
    updateStatus(status, text) {
        console.log(`Status: ${status} - ${text}`);
        this.onStatusChange?.({ status, text });
    }
    
    addMessage(sender, message, type = 'normal') {
        console.log(`${sender}: ${message}`);
        this.onMessage?.({ sender, message, type });
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.LeetSpeakVoiceClient = LeetSpeakVoiceClient;
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeetSpeakVoiceClient;
}

// Export for ES modules
export default LeetSpeakVoiceClient;
export { LeetSpeakVoiceClient };