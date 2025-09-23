/**
 * Chrome Extension Bridge - Handles Chrome extension message passing and LeetCode context
 */

import { EXTENSION_ACTIONS, LEETCODE_URLS } from './constants.js';

export class ChromeExtensionBridge {
    constructor(onStartVoiceChat = null, onStopVoiceChat = null, onGetStatus = null) {
        this.onStartVoiceChat = onStartVoiceChat;
        this.onStopVoiceChat = onStopVoiceChat;
        this.onGetStatus = onGetStatus;
        
        this.init();
    }

    /**
     * Initialize Chrome extension message handlers
     */
    init() {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.handleExtensionMessage(message, sender, sendResponse);
            });
        }
    }

    /**
     * Handle Chrome extension messages
     */
    handleExtensionMessage(message, sender, sendResponse) {
        switch (message.action) {
            case EXTENSION_ACTIONS.START_VOICE_CHAT:
                this.onStartVoiceChat?.(message.config).then(result => {
                    sendResponse({ success: true, data: result });
                }).catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
                return true; // Keep channel open for async response
                
            case EXTENSION_ACTIONS.STOP_VOICE_CHAT:
                this.onStopVoiceChat?.().then(result => {
                    sendResponse({ success: true, data: result });
                }).catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
                return true;
                
            case EXTENSION_ACTIONS.GET_SESSION_STATUS:
                const status = this.onGetStatus?.();
                sendResponse({ 
                    success: true, 
                    data: status
                });
                break;
        }
    }

    /**
     * Get current LeetCode problem context
     */
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
                chrome.tabs.sendMessage(tab.id, { action: EXTENSION_ACTIONS.GET_LEETCODE_DATA }, (response) => {
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

    /**
     * Broadcast connection state to all LeetCode tabs
     */
    broadcastConnectionState(state, sessionId = null, isConnected = false, sessionActive = false) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.query({ url: LEETCODE_URLS }, (tabs) => {
                    if (tabs.length === 0) {
                        resolve();
                        return;
                    }
                    
                    let completedTabs = 0;
                    const totalTabs = tabs.length;
                    
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: EXTENSION_ACTIONS.VOICE_CONNECTION_STATE_CHANGED,
                            state: state,
                            sessionId: sessionId,
                            isConnected: isConnected,
                            sessionActive: sessionActive
                        }).catch(error => {
                            // Silently handle message channel errors - they're not critical
                            if (!error.message.includes('message channel closed')) {
                                console.log(`Could not send message to tab ${tab.id}:`, error.message);
                            }
                        }).finally(() => {
                            completedTabs++;
                            if (completedTabs === totalTabs) {
                                resolve();
                            }
                        });
                    });
                });
            } else {
                resolve();
            }
        });
    }
}