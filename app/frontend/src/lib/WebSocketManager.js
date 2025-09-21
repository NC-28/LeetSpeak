/**
 * WebSocket Manager - Handles WebSocket connections and message routing
 */

import { API_ENDPOINTS, CONNECTION_STATES } from './constants.js';

export class WebSocketManager {
    constructor(websocketUrl, onMessage = null, onConnectionChange = null) {
        this.websocketUrl = websocketUrl;
        this.websocket = null;
        this.isConnected = false;
        
        this.onMessage = onMessage; // Callback for incoming messages
        this.onConnectionChange = onConnectionChange; // Callback for connection state changes
    }

    /**
     * Connect to backend WebSocket
     */
    async connect(sessionId) {
        return new Promise((resolve, reject) => {
            const wsUrl = `${this.websocketUrl}${API_ENDPOINTS.WEBSOCKET.replace('{sessionId}', sessionId)}`;
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('✅ Connected to backend WebSocket');
                this.isConnected = true;
                this.onConnectionChange?.(CONNECTION_STATES.CONNECTED);
                resolve();
            };
            
            this.websocket.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
            this.websocket.onerror = (error) => {
                console.error('❌ Backend WebSocket error:', error);
                reject(new Error('Backend connection failed'));
            };
            
            this.websocket.onclose = () => {
                console.log('Backend WebSocket disconnected');
                this.isConnected = false;
                this.onConnectionChange?.(CONNECTION_STATES.DISCONNECTED);
                this.handleDisconnection();
            };
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(data) {
        try {
            const event = JSON.parse(data);
            console.log('📨 Received from backend:', event.type);
            this.onMessage?.(event);
        } catch (error) {
            console.error('Error parsing backend message:', error);
        }
    }

    /**
     * Send message through WebSocket
     */
    send(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
            return true;
        }
        return false;
    }

    /**
     * Send audio data
     */
    sendAudioData(base64Audio) {
        return this.send({
            type: 'audio_data',
            audio: base64Audio
        });
    }

    /**
     * Send response cancellation
     */
    cancelResponse(responseId) {
        return this.send({
            type: 'response.cancel',
            response_id: responseId
        });
    }

    /**
     * Close WebSocket connection
     */
    disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.isConnected = false;
    }

    /**
     * Handle disconnection
     */
    handleDisconnection() {
        // This will be called by the main client to handle cleanup
        this.onConnectionChange?.(CONNECTION_STATES.DISCONNECTED);
    }

    /**
     * Check if WebSocket is connected
     */
    isWebSocketConnected() {
        return this.isConnected && this.websocket && this.websocket.readyState === WebSocket.OPEN;
    }
}