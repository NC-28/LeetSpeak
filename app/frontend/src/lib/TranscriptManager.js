/**
 * Transcript Manager - Manages transcript tracking and response handling
 */

import { TIMING_CONFIG } from './constants.js';

export class TranscriptManager {
    constructor(onMessage = null, onTranscript = null) {
        // Transcript tracking
        this.currentResponse = '';
        this.responseTranscripts = new Map();
        this.completedResponses = new Set();
        this.cancelledResponses = new Set();
        this.activeResponseId = null;
        this.isCancelling = false;
        
        // Barge-in handling
        this.lastBargeInTime = 0;
        this.bargeInCooldownMs = TIMING_CONFIG.BARGE_IN_COOLDOWN_MS;
        
        // Event callbacks
        this.onMessage = onMessage;
        this.onTranscript = onTranscript;
    }

    /**
     * Handle speech started event (potential barge-in)
     */
    handleSpeechStarted() {
        const nowTs = Date.now();
        if (nowTs - this.lastBargeInTime < this.bargeInCooldownMs) {
            console.log('🛑 Ignoring speech_started (within cooldown)');
            return false;
        }
        
        const shouldInterrupt = this.activeResponseId && !this.isCancelling;
        if (shouldInterrupt) {
            this.onMessage?.('System', '🎤 Speech detected (interrupt)...', 'system');
            this.lastBargeInTime = nowTs;
            return true;
        }
        
        return false;
    }

    /**
     * Start new response
     */
    startResponse(responseId = null, isEvaluation = false) {
        this.showTyping(true, isEvaluation);
        this.currentResponse = '';
        this.isCancelling = false;
        this.activeResponseId = responseId;
    }

    /**
     * Handle user transcript completion
     */
    handleUserTranscript(transcript) {
        if (transcript) {
            console.log('✅ User transcription:', transcript);
            this.onMessage?.('', transcript, 'user');
            this.onTranscript?.({ type: 'user', text: transcript });
        }
    }

    /**
     * Handle response transcript delta
     */
    handleResponseDelta(delta, responseId) {
        if (delta && responseId) {
            if (!this.responseTranscripts.has(responseId)) {
                this.responseTranscripts.set(responseId, '');
            }
            
            const updatedTranscript = this.responseTranscripts.get(responseId) + delta;
            this.responseTranscripts.set(responseId, updatedTranscript);
            this.currentResponse = updatedTranscript;
        }
    }

    /**
     * Handle response transcript completion
     */
    handleResponseComplete(responseId) {
        if (responseId && !this.completedResponses.has(responseId)) {
            this.completedResponses.add(responseId);
            if (this.activeResponseId === responseId) {
                this.activeResponseId = null;
            }
            this.showTyping(false);
            
            const finalTranscript = this.responseTranscripts.get(responseId) || this.currentResponse;
            if (finalTranscript) {
                console.log(`✅ Response ${responseId} completed naturally (${finalTranscript.length} chars)`);
                this.onMessage?.('', finalTranscript, 'ai');
                this.onTranscript?.({ type: 'ai', text: finalTranscript });
            }
        } else if (responseId && this.completedResponses.has(responseId)) {
            // Response already completed (likely flushed during graceful shutdown)
            console.log(`⚠️ Response ${responseId} already completed, skipping duplicate`);
            if (this.activeResponseId === responseId) {
                this.activeResponseId = null;
            }
            this.showTyping(false);
        }
    }

    /**
     * Cancel current response
     */
    cancelResponse(responseId) {
        if (responseId && !this.completedResponses.has(responseId)) {
            console.log('⛔ Cancelling response', responseId);
            this.cancelledResponses.add(responseId);
            this.isCancelling = true;
            return true;
        }
        return false;
    }

    /**
     * Check if response should be cancelled
     */
    shouldCancelResponse(responseId) {
        return this.cancelledResponses.has(responseId) || this.isCancelling;
    }

    /**
     * Show/hide typing indicator
     */
    showTyping(show, isEvaluation = false) {
        console.log(`Typing indicator: ${show ? 'show' : 'hide'}${isEvaluation ? ' (evaluation)' : ''}`);
        if (show) {
            this.onMessage?.('System', isEvaluation ? 'typing-evaluation' : 'typing', isEvaluation ? 'typing-evaluation' : 'typing');
        } else {
            this.onMessage?.('System', 'typing', 'typing-hide');
        }
    }

    /**
     * Reset transcript state
     */
    reset() {
        this.currentResponse = '';
        this.responseTranscripts.clear();
        this.completedResponses.clear();
        this.cancelledResponses.clear();
        this.activeResponseId = null;
        this.isCancelling = false;
        this.lastBargeInTime = 0;
    }

}