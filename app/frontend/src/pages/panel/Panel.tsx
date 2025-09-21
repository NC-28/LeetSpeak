import React, { useState, useEffect, useRef } from 'react';

// Type for voice client to avoid module resolution issues
declare class LeetSpeakVoiceClient {
  constructor();
  startVoiceChat(config?: any): Promise<{ sessionId: string }>;
  stopVoiceChat(): Promise<void>;
  onStatusChange: ((status: any) => void) | null;
  onMessage: ((message: any) => void) | null;
  onTranscript: ((transcript: any) => void) | null;
  onError: ((error: Error) => void) | null;
}
import '@pages/panel/Panel.css';

interface Message {
  sender: string;
  message: string;
  type: string;
  timestamp: number;
}

interface StatusInfo {
  status: string;
  text: string;
}

export default function Panel() {
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusInfo>({ status: 'disconnected', text: 'Not connected' });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [config, setConfig] = useState({
    endpoint: '',
    apiKey: '',
    model: 'gpt-4o-mini',
    voice: 'en-US-Ava:DragonHDLatestNeural'
  });
  const [showConfig, setShowConfig] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceClientRef = useRef<any>(null);
  
  useEffect(() => {
    initializeVoiceClient();
    
    // Load saved config
    chrome.storage.local.get(['leetspeak_config'], (result) => {
      if (result.leetspeak_config) {
        setConfig(result.leetspeak_config);
      }
    });
    
    return () => {
      if (voiceClientRef.current) {
        voiceClientRef.current.stopVoiceChat().catch(console.error);
      }
    };
  }, []);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
    const initializeVoiceClient = async () => {
    try {
      // Import voice client with type assertion to bypass module resolution
      const voiceClientModule = await import('../../lib/voiceClient.js' as any);
      const VoiceClient = voiceClientModule.default || voiceClientModule.LeetSpeakVoiceClient;
      
      if (!VoiceClient) {
        throw new Error('LeetSpeakVoiceClient not found in module');
      }
      
      voiceClientRef.current = new VoiceClient() as LeetSpeakVoiceClient;      voiceClientRef.current.onStatusChange = (statusInfo: StatusInfo) => {
        setStatus(statusInfo);
        setIsConnected(statusInfo.status === 'connected');
      };
      
      voiceClientRef.current.onMessage = (msg: any) => {
        if (msg.type === 'typing') {
          setIsTyping(true);
        } else if (msg.type === 'typing-hide') {
          setIsTyping(false);
        } else if (msg.type !== 'system' || msg.message !== 'typing') {
          addMessage(msg.sender, msg.message, msg.type);
        }
      };
      
      voiceClientRef.current.onError = (error: Error) => {
        addMessage('System', `Error: ${error.message}`, 'error');
      };
      
    } catch (error) {
      console.error('Failed to initialize voice client:', error);
      setStatus({ status: 'error', text: 'Failed to initialize voice client' });
    }
  };
  
  const addMessage = (sender: string, message: string, type: string = 'normal') => {
    const newMessage: Message = {
      sender,
      message,
      type,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, newMessage]);
  };
  
  const handleStartChat = async () => {
    // Refresh the webpage first and wait for it to finish loading
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        const tabId = tabs[0].id;
        
        // Add a listener to wait for the page to finish loading
        const onUpdatedListener = (updatedTabId: number, changeInfo: any) => {
          if (updatedTabId === tabId && changeInfo.status === 'complete') {
            // Remove the listener once loading is complete
            chrome.tabs.onUpdated.removeListener(onUpdatedListener);
            
            addMessage('System', '🔄 Page refreshed and loaded successfully', 'system');
            
            // Continue with voice chat initialization
            continueWithVoiceChat();
          }
        };
        
        chrome.tabs.onUpdated.addListener(onUpdatedListener);
        chrome.tabs.reload(tabId);
      }
    });
  };
  
  const continueWithVoiceChat = async () => {
    if (!voiceClientRef.current) {
      addMessage('System', 'Voice client not initialized', 'error');
      return;
    }
    
    try {
      setStatus({ status: 'connecting', text: 'Starting voice chat...' });
      
      chrome.storage.local.set({ leetspeak_config: config });
      
      const result = await voiceClientRef.current.startVoiceChat(config);
      setSessionId(result.sessionId);
      addMessage('System', '🎙️ Voice chat started! The AI technical interviewer is ready. You can now speak naturally about the LeetCode problem on this page.', 'system');
      
    } catch (error) {
      console.error('Failed to start voice chat:', error);
      addMessage('System', `Failed to start: ${(error as Error).message}`, 'error');
    }
  };
  
  const handleStopChat = async () => {
    if (!voiceClientRef.current) return;
    
    try {
      await voiceClientRef.current.stopVoiceChat();
      setSessionId(null);
      addMessage('System', '✋ Voice chat session ended. Great job on your practice!', 'system');
      
    } catch (error) {
      console.error('Failed to stop voice chat:', error);
      addMessage('System', `Failed to stop: ${(error as Error).message}`, 'error');
    }
  };
  
  const handleClearMessages = () => {
    setMessages([]);
  };
  
  const handleRefreshScrapers = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "refreshScrapers" }, (response) => {
          if (response?.status === 'refreshed') {
            addMessage('System', '🔄 Content scrapers refreshed', 'system');
          }
        });
      }
    });
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      case 'disconnecting': return 'bg-orange-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  const getMessageStyle = (type: string) => {
    switch (type) {
      case 'user': return 'bg-blue-50 border-l-4 border-blue-400 ml-8';
      case 'ai': return 'bg-green-50 border-l-4 border-green-400 mr-8';
      case 'system': return 'bg-gray-50 border-l-4 border-gray-400';
      case 'error': return 'bg-red-50 border-l-4 border-red-400';
      default: return 'bg-white border border-gray-200';
    }
  };
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded-full ${getStatusColor(status.status)}`}></div>
            <div>
              <h1 className="font-bold text-lg">LeetSpeak - AI Technical Interview Assistant</h1>
              <p className="text-sm opacity-90">{status.text}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="px-3 py-1 bg-white bg-opacity-20 rounded text-sm hover:bg-opacity-30 transition-colors"
            >
              ⚙️ Config
            </button>
            <button
              onClick={handleRefreshScrapers}
              className="px-3 py-1 bg-white bg-opacity-20 rounded text-sm hover:bg-opacity-30 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>
      
      {/* Configuration Panel */}
      {showConfig && (
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Azure Endpoint</label>
              <input
                type="text"
                placeholder="https://your-resource.cognitiveservices.azure.com/"
                value={config.endpoint}
                onChange={(e) => setConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                placeholder="Your Azure API Key"
                value={config.apiKey}
                onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <select
                value={config.model}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4.1-nano">GPT-4.1 Nano</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Voice</label>
              <select
                value={config.voice}
                onChange={(e) => setConfig(prev => ({ ...prev, voice: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="en-US-Ava:DragonHDLatestNeural">Ava (Professional)</option>
                <option value="en-US-Brian:DragonHDLatestNeural">Brian (Friendly)</option>
                <option value="en-US-Emma:DragonHDLatestNeural">Emma (Clear)</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            <p><strong>Note:</strong> If fields are left empty, the extension will use configuration from your backend server's .env file.</p>
          </div>
        </div>
      )}
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="mb-6">
                <svg className="w-20 h-20 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Ready for Your Technical Interview!</h3>
              <div className="space-y-2 text-sm max-w-md">
                <p>🎯 Navigate to a LeetCode problem</p>
                <p>🎙️ Click "Start Voice Chat" to begin</p>
                <p>💬 Discuss your approach with the AI interviewer</p>
                <p>🚀 Get real-time feedback as you code</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`p-4 rounded-lg shadow-sm ${getMessageStyle(msg.type)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {msg.type !== 'system' && msg.type !== 'error' && (
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold text-sm">{msg.sender}</span>
                        <span className="text-xs text-gray-500">{formatTimestamp(msg.timestamp)}</span>
                      </div>
                    )}
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</div>
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="bg-green-50 border-l-4 border-green-400 mr-8 p-4 rounded-lg shadow-sm">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="font-semibold text-sm">🤖 AI Interviewer</span>
                  <span className="text-xs text-gray-500">now</span>
                </div>
                <div className="text-sm flex items-center">
                  <span>Thinking about your response</span>
                  <div className="ml-3 flex space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex space-x-3">
            {!isConnected ? (
              <button
                onClick={handleStartChat}
                disabled={status.status === 'connecting'}
                className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span>{status.status === 'connecting' ? 'Starting...' : 'Start Voice Chat'}</span>
              </button>
            ) : (
              <button
                onClick={handleStopChat}
                disabled={status.status === 'disconnecting'}
                className="flex items-center space-x-2 bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                </svg>
                <span>{status.status === 'disconnecting' ? 'Stopping...' : 'Stop Voice Chat'}</span>
              </button>
            )}
            
            {messages.length > 0 && (
              <button
                onClick={handleClearMessages}
                className="flex items-center space-x-2 bg-gray-500 text-white px-4 py-3 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Clear</span>
              </button>
            )}
          </div>
          
          <div className="text-right">
            {sessionId && (
              <div className="text-xs text-gray-500 mb-1">
                Session ID: {sessionId.substring(0, 8)}...
              </div>
            )}
            {isConnected && (
              <div className="text-xs text-green-600 font-medium">
                🔴 Recording - Speak naturally
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
