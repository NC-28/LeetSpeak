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

export default function Popup() {
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusInfo>({ status: 'disconnected', text: 'Not connected' });
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [config, setConfig] = useState({
    endpoint: '',
    apiKey: '',
    model: 'gpt-4o-mini'
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceClientRef = useRef<any>(null);
  
  useEffect(() => {
    // Initialize voice client when popup opens
    initializeVoiceClient();
    
    // Load saved config
    chrome.storage.local.get(['leetspeak_config'], (result) => {
      if (result.leetspeak_config) {
        setConfig(result.leetspeak_config);
      }
    });
    
    return () => {
      // Cleanup when popup closes
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
      
      voiceClientRef.current = new VoiceClient() as LeetSpeakVoiceClient;
      
      // Set up event handlers
      voiceClientRef.current.onStatusChange = (statusInfo: StatusInfo) => {
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
      
      voiceClientRef.current.onTranscript = (transcript: any) => {
        // Transcripts are handled via onMessage callback
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
    if (!voiceClientRef.current) {
      addMessage('System', 'Voice client not initialized', 'error');
      return;
    }
    
    try {
      setStatus({ status: 'connecting', text: 'Starting voice chat...' });
      
      // Save config
      chrome.storage.local.set({ leetspeak_config: config });
      
      const result = await voiceClientRef.current.startVoiceChat(config);
      setSessionId(result.sessionId);
      addMessage('System', 'Voice chat started! You can now speak to the AI.', 'system');
      
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
      addMessage('System', 'Voice chat stopped.', 'system');
      
    } catch (error) {
      console.error('Failed to stop voice chat:', error);
      addMessage('System', `Failed to stop: ${(error as Error).message}`, 'error');
    }
  };
  
  const handleClearMessages = () => {
    setMessages([]);
  };
  
  const openPanel = () => {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
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
      case 'user': return 'bg-blue-100 border-l-4 border-blue-400 ml-4';
      case 'ai': return 'bg-green-100 border-l-4 border-green-400 mr-4';
      case 'system': return 'bg-gray-100 border-l-4 border-gray-400 text-sm';
      case 'error': return 'bg-red-100 border-l-4 border-red-400 text-sm';
      default: return 'bg-white border border-gray-200';
    }
  };
  
  return (
    <div className="w-80 h-96 bg-white text-gray-800 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(status.status)}`}></div>
            <h1 className="font-bold text-sm">LeetSpeak</h1>
          </div>
          <button
            onClick={openPanel}
            className="text-xs px-2 py-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition-colors"
          >
            Open Panel
          </button>
        </div>
        <p className="text-xs mt-1 opacity-90">{status.text}</p>
      </div>
      
      {/* Configuration */}
      {!isConnected && (
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Azure Endpoint (optional)"
              value={config.endpoint}
              onChange={(e) => setConfig(prev => ({ ...prev, endpoint: e.target.value }))}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="API Key (optional)"
              value={config.apiKey}
              onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={config.model}
              onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4.1-nano">GPT-4.1 Nano</option>
            </select>
          </div>
        </div>
      )}
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-8">
            <div className="mb-4">
              <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <p>No messages yet</p>
            <p className="text-xs mt-1">Start a voice chat to begin your AI technical interview!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`p-2 rounded ${getMessageStyle(msg.type)}`}>
              {msg.type !== 'system' && msg.type !== 'error' && (
                <div className="font-semibold text-xs mb-1">{msg.sender}</div>
              )}
              <div className="text-sm">{msg.message}</div>
            </div>
          ))
        )}
        
        {isTyping && (
          <div className="bg-green-100 border-l-4 border-green-400 mr-4 p-2 rounded">
            <div className="font-semibold text-xs mb-1">🤖 AI</div>
            <div className="text-sm flex items-center">
              <span>Thinking</span>
              <div className="ml-2 flex space-x-1">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1 h-1 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Controls */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex space-x-2">
          {!isConnected ? (
            <button
              onClick={handleStartChat}
              disabled={status.status === 'connecting'}
              className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
            >
              {status.status === 'connecting' ? 'Starting...' : 'Start Voice Chat'}
            </button>
          ) : (
            <button
              onClick={handleStopChat}
              disabled={status.status === 'disconnecting'}
              className="flex-1 bg-red-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
            >
              {status.status === 'disconnecting' ? 'Stopping...' : 'Stop Voice Chat'}
            </button>
          )}
          
          {messages.length > 0 && (
            <button
              onClick={handleClearMessages}
              className="px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        
        {sessionId && (
          <div className="mt-2 text-xs text-gray-500 text-center">
            Session: {sessionId.substring(0, 8)}...
          </div>
        )}
      </div>
    </div>
  );
}
