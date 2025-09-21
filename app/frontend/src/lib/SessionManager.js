/**
 * Session Manager - Handles session lifecycle and backend API calls
 */

import { API_ENDPOINTS, DEFAULT_CONFIG } from './constants.js';

export class SessionManager {
    constructor(backendUrl = DEFAULT_CONFIG.BACKEND_URL) {
        this.backendUrl = backendUrl;
        this.sessionId = null;
        this.sessionActive = false;
    }

    /**
     * Create a new session
     */
    async createSession(model = DEFAULT_CONFIG.MODEL) {
        const response = await fetch(`${this.backendUrl}${API_ENDPOINTS.SESSIONS}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to create session: ${response.statusText}`);
        }
        
        const sessionData = await response.json();
        this.sessionId = sessionData.session_id;
        return sessionData;
    }

    /**
     * Start backend session with configuration
     */
    async startSession(config, context = null) {
        if (!this.sessionId) {
            throw new Error('No session ID available. Create session first.');
        }

        const endpoint = API_ENDPOINTS.START_SESSION.replace('{sessionId}', this.sessionId);
        const response = await fetch(`${this.backendUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: config.model || DEFAULT_CONFIG.MODEL,
                endpoint: config.endpoint,
                api_key: config.api_key,
                context: context // Send LeetCode context to backend
            })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to start session: ${response.statusText}`);
        }
        
        this.sessionActive = true;
        return await response.json();
    }

    /**
     * Stop backend session
     */
    async stopSession() {
        if (!this.sessionId) {
            return;
        }
        
        const endpoint = API_ENDPOINTS.STOP_SESSION.replace('{sessionId}', this.sessionId);
        const response = await fetch(`${this.backendUrl}${endpoint}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            console.warn(`Failed to stop session: ${response.statusText}`);
        }
        
        this.sessionActive = false;
        const result = await response.json();
        this.reset();
        return result;
    }

    /**
     * Reset session state
     */
    reset() {
        this.sessionId = null;
        this.sessionActive = false;
    }

    /**
     * Get current session status
     */
    getStatus() {
        return {
            sessionId: this.sessionId,
            sessionActive: this.sessionActive,
            hasSession: !!this.sessionId
        };
    }
}