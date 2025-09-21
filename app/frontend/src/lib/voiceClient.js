/**
 * LeetSpeak Voice Client for Chrome Extension
 * Handles voice chat functionality integrated with FastAPI backend
 */

class LeetSpeakVoiceClient {
    constructor() {
        this.sessionId = null;
        this.backendUrl = 'http://localhost:8000';
        this.websocketUrl = 'ws://localhost:8000';
        this.websocket = null;
        this.audioContext = null;
        this.mediaStream = null;
        this.audioWorkletNode = null;
        this.isConnected = false;
        this.isRecording = false;
        this.sessionActive = false;
        this.isIntentionallyStopping = false; // Track intentional stops
        
        // Audio settings - Azure Voice Live uses 24kHz, 16-bit PCM
        this.sampleRate = 24000; // Azure Voice Live standard
        this.inputSampleRate = 24000; // Input rate for getUserMedia
        this.audioQueue = [];
        this.isPlaying = false;
        this.nextPlayTime = 0;
        this.currentAudioSource = null;
        this.audioChunks = [];
        this.isProcessingAudio = false;
        
        // Transcript tracking
        this.currentResponse = '';
        this.responseTranscripts = new Map();
        this.completedResponses = new Set();
        this.activeResponseId = null;
        this.cancelledResponses = new Set();
        this.isCancelling = false;
        this.scheduledSources = [];
        this.lastBargeInTime = 0;
        this.bargeInCooldownMs = 1200;
        this.pendingUserTranscript = '';
        
        // Event callbacks
        this.onStatusChange = null;
        this.onMessage = null;
        this.onTranscript = null;
        this.onError = null;
        
        this.init();
    }
    
    async init() {
        // Register service worker message handler
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.handleExtensionMessage(message, sender, sendResponse);
            });
        }
    }
    
    handleExtensionMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'startVoiceChat':
                this.startVoiceChat(message.config).then(result => {
                    sendResponse({ success: true, data: result });
                }).catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
                return true; // Keep channel open for async response
                
            case 'stopVoiceChat':
                this.stopVoiceChat().then(result => {
                    sendResponse({ success: true, data: result });
                }).catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
                return true;
                
            case 'getSessionStatus':
                sendResponse({ 
                    success: true, 
                    data: { 
                        sessionId: this.sessionId, 
                        isConnected: this.isConnected,
                        sessionActive: this.sessionActive 
                    } 
                });
                break;
        }
    }
    
    async startVoiceChat(config = {}) {
        try {
            this.updateStatus('connecting', 'Starting voice chat session...');
            
            // Create session
            const sessionResponse = await this.createSession();
            this.sessionId = sessionResponse.session_id;
            
            // Initialize audio
            await this.initializeAudio();
            
            // Connect to backend WebSocket
            await this.connectToBackend();
            
            // Start the session with Azure
            await this.startBackendSession(config);
            
            this.sessionActive = true;
            this.broadcastConnectionState('sessionActive');
            this.updateStatus('connected', 'Voice chat active');
            
            return { sessionId: this.sessionId, status: 'active' };
            
        } catch (error) {
            this.updateStatus('error', `Failed to start: ${error.message}`);
            throw error;
        }
    }
    
    async stopVoiceChat() {
        try {
            this.updateStatus('disconnecting', 'Stopping voice chat...');
            
            // Mark that we're intentionally stopping
            this.isIntentionallyStopping = true;
            
            // Stop audio recording and playback
            this.stopAudio();
            
            // Close WebSocket connection
            if (this.websocket) {
                this.websocket.close();
                this.websocket = null;
            }
            
            // Stop backend session
            if (this.sessionId) {
                await this.stopBackendSession();
            }
            
            this.sessionActive = false;
            this.isConnected = false;
            this.sessionId = null;
            
            this.broadcastConnectionState('sessionStopped');
            this.updateStatus('disconnected', 'Voice chat stopped');
            
            // Reset the flag after a short delay to ensure it doesn't interfere
            setTimeout(() => {
                this.isIntentionallyStopping = false;
            }, 100);
            
            return { status: 'stopped' };
            
        } catch (error) {
            this.isIntentionallyStopping = false; // Reset flag on error
            this.updateStatus('error', `Error stopping: ${error.message}`);
            throw error;
        }
    }
    
    async createSession() {
        const response = await fetch(`${this.backendUrl}/api/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini'
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create session: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    async startBackendSession(config) {
        // Get current LeetCode problem context before starting session
        const context = await this.getLeetCodeContext();
        
        const response = await fetch(`${this.backendUrl}/api/sessions/${this.sessionId}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: config.model || 'gpt-4o-mini',
                endpoint: config.endpoint,
                api_key: config.api_key,
                context: context // Send LeetCode context to backend
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to start session: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    async getLeetCodeContext() {
        try {
            // Query active tab for LeetCode content
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || !tab.url.includes('leetcode.com')) {
                console.warn('Not on a LeetCode page');
                return null;
            }
            
            // Send message to content script to get problem data
            const context = await new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(tab.id, { action: 'getLeetCodeData' }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
            
            console.log('📊 LeetCode context retrieved:', context);
            return context;
            
        } catch (error) {
            console.warn('Failed to get LeetCode context:', error);
            return null;
        }
    }
    
    async stopBackendSession() {
        if (!this.sessionId) return;
        
        const response = await fetch(`${this.backendUrl}/api/sessions/${this.sessionId}/stop`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            console.warn(`Failed to stop session: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    async connectToBackend() {
        return new Promise((resolve, reject) => {
            const wsUrl = `${this.websocketUrl}/ws/extension/${this.sessionId}`;
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('✅ Connected to backend WebSocket');
                this.isConnected = true;
                this.broadcastConnectionState('connected');
                resolve();
            };
            
            this.websocket.onmessage = (event) => {
                this.handleBackendMessage(event.data);
            };
            
            this.websocket.onerror = (error) => {
                console.error('❌ Backend WebSocket error:', error);
                reject(new Error('Backend connection failed'));
            };
            
            this.websocket.onclose = () => {
                console.log('Backend WebSocket disconnected');
                this.isConnected = false;
                this.broadcastConnectionState('disconnected');
                this.handleDisconnection();
            };
        });
    }
    
    async initializeAudio() {
        try {
            console.log('Requesting microphone permission...');
            
            // Request microphone access directly (no Chrome extension permissions needed for getUserMedia)
            console.log('Requesting getUserMedia...');
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.sampleRate,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Create audio context
            console.log('Creating AudioContext...');
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Load audio worklet - use relative path since it should be in web_accessible_resources
            console.log('Loading audio worklet...');
            try {
                await this.audioContext.audioWorklet.addModule('./audio-processor.js');
            } catch (workletError) {
                console.warn('Failed to load local audio worklet, trying Chrome extension URL:', workletError);
                // Fallback to Chrome extension URL
                const audioProcessorUrl = chrome.runtime.getURL('audio-processor.js');
                await this.audioContext.audioWorklet.addModule(audioProcessorUrl);
            }
            
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
            
            // Handle processed audio data
            this.audioWorkletNode.port.onmessage = (event) => {
                if (this.isConnected && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                    const audioData = event.data;
                    const base64Audio = this.arrayBufferToBase64(audioData);
                    
                    this.websocket.send(JSON.stringify({
                        type: 'audio_data',
                        audio: base64Audio
                    }));
                }
            };
            
            source.connect(this.audioWorkletNode);
            this.isRecording = true;
            console.log('Audio initialization complete');
            
        } catch (error) {
            console.error('Audio initialization failed:', error);
            
            if (error.name === 'NotAllowedError') {
                throw new Error('Microphone permission denied. Please click "Allow" when prompted for microphone access.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No microphone found. Please connect a microphone and try again.');
            } else if (error.name === 'NotReadableError') {
                throw new Error('Microphone is being used by another application.');
            } else {
                throw new Error(`Failed to initialize audio: ${error.message}`);
            }
        }
    }
    
    handleBackendMessage(data) {
        try {
            const event = JSON.parse(data);
            const eventType = event.type;
            
            console.log('📨 Received from backend:', eventType);
            
            switch (eventType) {
                case 'session.created':
                    console.log('✅ Azure session created');
                    break;
                    
                case 'input_audio_buffer.speech_started':
                    const nowTs = Date.now();
                    if (nowTs - this.lastBargeInTime < this.bargeInCooldownMs) {
                        console.log('🛑 Ignoring speech_started (within cooldown)');
                        break;
                    }
                    
                    const aiSpeaking = this.scheduledSources.length > 0 || this.currentAudioSource;
                    if (aiSpeaking || (this.activeResponseId && !this.isCancelling)) {
                        this.addMessage('System', '🎤 Speech detected (interrupt)...', 'system');
                        this.interruptForUserSpeech();
                        this.lastBargeInTime = nowTs;
                    }
                    break;
                    
                case 'response.created':
                    this.showTyping(true);
                    this.currentResponse = '';
                    this.audioChunks = [];
                    this.isCancelling = false;
                    this.activeResponseId = (event.response && event.response.id) || event.response_id || event.item_id || null;
                    this.stopAllScheduledAudio();
                    break;
                    
                case 'conversation.item.input_audio_transcription.completed':
                    const userTranscript = event.transcript;
                    if (userTranscript) {
                        console.log('✅ User transcription:', userTranscript);
                        this.addMessage('👤 You', userTranscript, 'user');
                        this.onTranscript?.({ type: 'user', text: userTranscript });
                    }
                    break;
                    
                case 'response.audio_transcript.delta':
                    const delta = event.delta;
                    const responseId = event.response_id || event.item_id;
                    
                    if (delta && responseId) {
                        if (!this.responseTranscripts.has(responseId)) {
                            this.responseTranscripts.set(responseId, '');
                        }
                        
                        const updatedTranscript = this.responseTranscripts.get(responseId) + delta;
                        this.responseTranscripts.set(responseId, updatedTranscript);
                        this.currentResponse = updatedTranscript;
                    }
                    break;
                    
                case 'response.audio_transcript.done':
                    const finalResponseId = event.response_id || event.item_id;
                    
                    if (finalResponseId && !this.completedResponses.has(finalResponseId)) {
                        this.completedResponses.add(finalResponseId);
                        if (this.activeResponseId === finalResponseId) {
                            this.activeResponseId = null;
                        }
                        this.showTyping(false);
                        
                        const finalTranscript = this.responseTranscripts.get(finalResponseId) || this.currentResponse;
                        if (finalTranscript) {
                            this.addMessage('🤖 AI', finalTranscript, 'ai');
                            this.onTranscript?.({ type: 'ai', text: finalTranscript });
                        }
                    }
                    break;
                    
                case 'response.audio.delta':
                    const audioData = event.delta;
                    if (this.isCancelling) {
                        console.log('⚠️ Ignoring audio delta during cancellation');
                        break;
                    }
                    if (audioData) {
                        this.audioChunks.push(audioData);
                        this.processAudioBuffer();
                    }
                    break;
                    
                case 'response.audio.done':
                    console.log('🔊 Audio done, processing final chunks:', this.audioChunks.length);
                    this.processAudioBuffer(true);
                    break;
                    
                case 'error':
                    const error = event.error || {};
                    const msg = error.message || error.code || 'Unknown error';
                    this.addMessage('System', `Error: ${msg}`, 'system');
                    this.onError?.(new Error(msg));
                    break;
            }
            
        } catch (error) {
            console.error('Error parsing backend message:', error);
        }
    }
    
    processAudioBuffer(isComplete = false) {
        if (this.isProcessingAudio || this.isCancelling) {
            return;
        }
        
        const minChunks = isComplete ? 1 : 5;
        if (this.audioChunks.length < minChunks) {
            return;
        }
        
        const chunksToProcess = this.audioChunks.splice(0, this.audioChunks.length);
        
        if (chunksToProcess.length > 0) {
            this.isProcessingAudio = true;
            this.playAudioChunks(chunksToProcess).then(() => {
                this.isProcessingAudio = false;
                if (this.audioChunks.length > 0) {
                    setTimeout(() => this.processAudioBuffer(false), 10);
                }
            }).catch(error => {
                console.error('Error processing audio batch:', error);
                this.isProcessingAudio = false;
            });
        }
    }
    
    async playAudioChunks(chunks) {
        try {
            if (!this.audioContext || chunks.length === 0) return;
            
            console.log('🔊 Playing audio chunks:', chunks.length);
            
            for (const base64Audio of chunks) {
                try {
                    // Decode base64 to binary
                    const binaryString = atob(base64Audio);
                    const audioData = new ArrayBuffer(binaryString.length);
                    const audioView = new Uint8Array(audioData);
                    
                    for (let i = 0; i < binaryString.length; i++) {
                        audioView[i] = binaryString.charCodeAt(i);
                    }
                    
                    // Try to decode as standard audio format first
                    try {
                        const audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));
                        this.audioQueue.push(audioBuffer);
                    } catch (decodeError) {
                        console.warn('Standard decode failed, trying PCM decode:', decodeError);
                        // Fallback to PCM decoding with correct sample rate
                        const pcmData = new Int16Array(audioData);
                        const audioBuffer = this.createAudioBufferFromPCM(pcmData, 24000); // Azure sends at 24kHz
                        if (audioBuffer) {
                            this.audioQueue.push(audioBuffer);
                        }
                    }
                    
                } catch (error) {
                    console.error('Error processing audio chunk:', error);
                }
            }
            
            // Start playback queue
            this.playQueue();
            
        } catch (error) {
            console.error('Error in playAudioChunks:', error);
        }
    }
    
    /**
     * Create AudioBuffer from PCM data with specific source sample rate
     */
    createAudioBufferFromPCM(pcmData, sourceSampleRate = 24000) {
        try {
            const frameCount = pcmData.length;
            // Create buffer at the source sample rate, let browser handle resampling
            const audioBuffer = this.audioContext.createBuffer(1, frameCount, sourceSampleRate);
            const outputData = audioBuffer.getChannelData(0);
            
            // Convert Int16 PCM to Float32
            for (let i = 0; i < frameCount; i++) {
                outputData[i] = pcmData[i] / 32768.0;
            }
            
            return audioBuffer;
            
        } catch (error) {
            console.error('Error creating audio buffer from PCM:', error);
            return null;
        }
    }
    
    /**
     * Plays the next audio buffer in the queue if nothing is currently playing.
     * Based on the original working implementation.
     */
    playQueue() {
        // If already playing or the queue is empty, do nothing.
        if (this.isPlaying || this.audioQueue.length === 0) return;

        // Set the flag so we don't start overlapping playback.
        this.isPlaying = true;
        // Get the next audio buffer.
        const buffer = this.audioQueue.shift();
        
        try {
            // Create a buffer source node.
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            
            // Store reference for potential interruption
            this.currentAudioSource = source;
            
            // Start playback immediately.
            source.start();
            console.log('🔊 Playing audio packet, duration:', buffer.duration.toFixed(2), 'seconds');

            // When playback finishes, reset the flag and try to play the next packet.
            source.onended = () => {
                this.isPlaying = false;
                this.currentAudioSource = null;
                this.playQueue(); // Continue with next in queue
            };
            
        } catch (error) {
            console.error('Error playing audio buffer:', error);
            this.isPlaying = false;
            this.currentAudioSource = null;
        }
    }
    
    stopAudio() {
        this.isRecording = false;
        this.isPlaying = false;
        this.isProcessingAudio = false; // Stop any ongoing audio processing
        
        if (this.currentAudioSource) {
            try {
                this.currentAudioSource.stop();
            } catch (e) {}
            this.currentAudioSource = null;
        }
        
        this.stopAllScheduledAudio();
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // Clear all pending audio output
        this.audioChunks = [];
        this.audioQueue = []; // Clear the audio queue to remove any pending audio
        this.nextPlayTime = 0;
        
        // Reset response tracking to prevent any pending audio from playing
        this.currentResponse = '';
        this.activeResponseId = null;
        this.isCancelling = true; // Prevent any new audio from being processed
    }
    
    interruptForUserSpeech() {
        try {
            this.stopAllScheduledAudio();
            this.audioChunks = [];
            this.isProcessingAudio = false;
            this.nextPlayTime = this.audioContext ? this.audioContext.currentTime : 0;
            
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN && this.activeResponseId && !this.completedResponses.has(this.activeResponseId)) {
                console.log('⛔ Sending response.cancel for response', this.activeResponseId);
                const cancelMsg = {
                    type: 'response.cancel',
                    response_id: this.activeResponseId
                };
                this.websocket.send(JSON.stringify(cancelMsg));
                this.cancelledResponses.add(this.activeResponseId);
                this.isCancelling = true;
            }
        } catch (e) {
            console.error('Error during interruption:', e);
        }
    }
    
    stopAllScheduledAudio() {
        for (const entry of this.scheduledSources) {
            try {
                entry.source.stop();
            } catch (e) {}
        }
        this.scheduledSources = [];
        this.currentAudioSource = null;
    }
    
    handleDisconnection() {
        if (this.sessionActive && !this.isIntentionallyStopping) {
            this.stopVoiceChat();
            this.onError?.(new Error('Connection lost. Please try again.'));
        }
    }
    
    // Utility functions
    broadcastConnectionState(state) {
        // Broadcast to all tabs with LeetCode pages
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.query({ url: ['*://leetcode.com/*', '*://*.leetcode.com/*', '*://leetcode.cn/*', '*://*.leetcode.cn/*'] }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'voiceConnectionStateChanged',
                        state: state,
                        sessionId: this.sessionId,
                        isConnected: this.isConnected,
                        sessionActive: this.sessionActive
                    }).catch(error => {
                        // Ignore errors for tabs that don't have content script loaded
                        console.log(`Could not send message to tab ${tab.id}:`, error.message);
                    });
                });
            });
        }
    }
    
    updateStatus(status, text) {
        console.log(`Status: ${status} - ${text}`);
        this.onStatusChange?.({ status, text });
    }
    
    addMessage(sender, message, type = 'normal') {
        console.log(`${sender}: ${message}`);
        this.onMessage?.({ sender, message, type });
    }
    
    showTyping(show) {
        console.log(`Typing indicator: ${show ? 'show' : 'hide'}`);
        this.onMessage?.({ sender: 'System', message: 'typing', type: show ? 'typing' : 'typing-hide' });
    }
    
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
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