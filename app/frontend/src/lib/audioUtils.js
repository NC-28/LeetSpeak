/**
 * Audio utility functions for LeetSpeak Voice Client
 */

import { AUDIO_CONFIG } from './constants.js';

/**
 * Convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Create AudioBuffer from PCM data with specific source sample rate
 */
export function createAudioBufferFromPCM(audioContext, pcmData, sourceSampleRate = AUDIO_CONFIG.SAMPLE_RATE) {
    try {
        const frameCount = pcmData.length;
        // Create buffer at the source sample rate, let browser handle resampling
        const audioBuffer = audioContext.createBuffer(1, frameCount, sourceSampleRate);
        const outputData = audioBuffer.getChannelData(0);
        
        // Convert Int16 PCM to Float32
        for (let i = 0; i < frameCount; i++) {
            outputData[i] = pcmData[i] / AUDIO_CONFIG.PCM_CONVERSION_FACTOR;
        }
        
        return audioBuffer;
        
    } catch (error) {
        console.error('Error creating audio buffer from PCM:', error);
        return null;
    }
}

/**
 * Get appropriate error message for audio initialization errors
 */
export function getAudioErrorMessage(error) {
    switch (error.name) {
        case 'NotAllowedError':
            return 'Microphone permission denied. Please click "Allow" when prompted for microphone access.';
        case 'NotFoundError':
            return 'No microphone found. Please connect a microphone and try again.';
        case 'NotReadableError':
            return 'Microphone is being used by another application.';
        default:
            return `Failed to initialize audio: ${error.message}`;
    }
}

/**
 * Create getUserMedia constraints for optimal voice quality
 */
export function getAudioConstraints(sampleRate = AUDIO_CONFIG.SAMPLE_RATE) {
    return {
        audio: {
            sampleRate,
            channelCount: AUDIO_CONFIG.CHANNEL_COUNT,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    };
}