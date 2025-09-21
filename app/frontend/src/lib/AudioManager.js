/**
 * Audio Manager - Handles all audio processing, recording, and playback
 */

import { AUDIO_CONFIG } from './constants.js';
import { arrayBufferToBase64, createAudioBufferFromPCM, getAudioErrorMessage, getAudioConstraints } from './audioUtils.js';

export class AudioManager {
    constructor(onAudioData = null) {
        this.audioContext = null;
        this.mediaStream = null;
        this.audioWorkletNode = null;
        this.audioQueue = [];
        this.audioChunks = [];
        
        this.isRecording = false;
        this.isPlaying = false;
        this.isProcessingAudio = false;
        this.currentAudioSource = null;
        
        this.onAudioData = onAudioData; // Callback for processed audio data
    }

    /**
     * Initialize audio recording and processing
     */
    async initialize() {
        try {
            console.log('Requesting microphone permission...');
            
            // Request microphone access
            console.log('Requesting getUserMedia...');
            this.mediaStream = await navigator.mediaDevices.getUserMedia(
                getAudioConstraints(AUDIO_CONFIG.SAMPLE_RATE)
            );

            // Create audio context
            console.log('Creating AudioContext...');
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: AUDIO_CONFIG.SAMPLE_RATE
            });
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Load audio worklet
            console.log('Loading audio worklet...');
            await this.loadAudioWorklet();
            
            // Set up audio processing
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
            
            // Handle processed audio data
            this.audioWorkletNode.port.onmessage = (event) => {
                const audioData = event.data;
                const base64Audio = arrayBufferToBase64(audioData);
                this.onAudioData?.(base64Audio);
            };
            
            source.connect(this.audioWorkletNode);
            this.isRecording = true;
            console.log('Audio initialization complete');
            
        } catch (error) {
            console.error('Audio initialization failed:', error);
            throw new Error(getAudioErrorMessage(error));
        }
    }

    /**
     * Load audio worklet with fallback
     */
    async loadAudioWorklet() {
        try {
            await this.audioContext.audioWorklet.addModule('./audio-processor.js');
        } catch (workletError) {
            console.warn('Failed to load local audio worklet, trying Chrome extension URL:', workletError);
            // Fallback to Chrome extension URL
            const audioProcessorUrl = chrome.runtime.getURL('audio-processor.js');
            await this.audioContext.audioWorklet.addModule(audioProcessorUrl);
        }
    }

    /**
     * Process audio buffer and play when ready
     */
    processAudioBuffer(isComplete = false) {
        if (this.isProcessingAudio) {
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

    /**
     * Play audio chunks
     */
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
                    let audioBuffer;
                    try {
                        audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));
                    } catch (decodeError) {
                        console.warn('Standard decode failed, trying PCM decode:', decodeError);
                        // Fallback to PCM decoding
                        const pcmData = new Int16Array(audioData);
                        audioBuffer = createAudioBufferFromPCM(this.audioContext, pcmData, AUDIO_CONFIG.SAMPLE_RATE);
                    }
                    
                    if (audioBuffer) {
                        this.audioQueue.push(audioBuffer);
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
     * Play the next audio buffer in the queue
     */
    playQueue() {
        // If already playing or the queue is empty, do nothing
        if (this.isPlaying || this.audioQueue.length === 0) return;

        // Set the flag so we don't start overlapping playback
        this.isPlaying = true;
        // Get the next audio buffer
        const buffer = this.audioQueue.shift();
        
        try {
            // Create a buffer source node
            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);
            
            // Store reference for potential interruption
            this.currentAudioSource = source;
            
            // Start playback immediately
            source.start();
            console.log('🔊 Playing audio packet, duration:', buffer.duration.toFixed(2), 'seconds');

            // When playback finishes, reset the flag and try to play the next packet
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

    /**
     * Add audio chunk to processing queue
     */
    addAudioChunk(audioData) {
        if (audioData) {
            this.audioChunks.push(audioData);
            this.processAudioBuffer();
        }
    }

    /**
     * Finalize audio processing
     */
    finalizeAudio() {
        console.log('🔊 Audio done, processing final chunks:', this.audioChunks.length);
        this.processAudioBuffer(true);
    }

    /**
     * Stop all audio processing and playback
     */
    stopAll() {
        this.isRecording = false;
        this.isPlaying = false;
        this.isProcessingAudio = false;
        
        // Stop current playback
        if (this.currentAudioSource) {
            try {
                this.currentAudioSource.stop();
            } catch (e) {}
            this.currentAudioSource = null;
        }
        
        // Stop media stream
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        // Close audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // Clear all pending audio
        this.clearQueues();
    }

    /**
     * Clear all audio queues
     */
    clearQueues() {
        this.audioChunks = [];
        this.audioQueue = [];
    }

    /**
     * Stop current audio playback (for interruption)
     */
    interrupt() {
        if (this.currentAudioSource) {
            try {
                this.currentAudioSource.stop();
            } catch (e) {}
            this.currentAudioSource = null;
        }
        this.clearQueues();
        this.isProcessingAudio = false;
    }
}