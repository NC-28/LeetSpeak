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
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      case 'disconnecting': return 'bg-orange-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };
  
  const getMessageStyle = (type: string) => {
    switch (type) {
      case 'user': return 'bg-blue-50 border border-blue-100';
      case 'ai': return 'bg-white border border-gray-200';
      case 'system': return 'bg-gray-50 border border-gray-200';
      case 'error': return 'bg-red-50 border border-red-200';
      default: return 'bg-white border border-gray-200';
    }
  };
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(status.status)}`}></div>
                <div>
                  <h1 className="font-semibold text-xl text-gray-900">LeetSpeak</h1>
                  <p className="text-sm text-gray-600">AI Technical Interview Assistant</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Session Status Bar */}
        <div className="px-6 py-2 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="font-medium">{status.text}</span>
              {sessionId && (
                <span className="text-gray-500">
                  Session: {sessionId.substring(0, 8)}...
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Configuration Panel */}
      {showConfig && (
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="px-6 py-5">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-1">Configuration</h3>
              <p className="text-sm text-gray-600">Configure your Azure AI services connection</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Azure Endpoint</label>
                <input
                  type="text"
                  placeholder="https://your-resource.cognitiveservices.azure.com/"
                  value={config.endpoint}
                  onChange={(e) => setConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">API Key</label>
                <input
                  type="password"
                  placeholder="Your Azure API Key"
                  value={config.apiKey}
                  onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Model</label>
                <select
                  value={config.model}
                  onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4.1-nano">GPT-4.1 Nano</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Voice</label>
                <select
                  value={config.voice}
                  onChange={(e) => setConfig(prev => ({ ...prev, voice: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="en-US-Ava:DragonHDLatestNeural">Ava (Professional)</option>
                  <option value="en-US-Brian:DragonHDLatestNeural">Brian (Friendly)</option>
                  <option value="en-US-Emma:DragonHDLatestNeural">Emma (Clear)</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Note:</span> If fields are left empty, the extension will use configuration from your backend server's .env file.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="text-center max-w-md">
              <div className="mb-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Ready for Your Technical Interview</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-blue-600">1</span>
                  </div>
                  <p className="text-left">Navigate to a LeetCode problem</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-blue-600">2</span>
                  </div>
                  <p className="text-left">Click "Start Voice Chat" to begin</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-blue-600">3</span>
                  </div>
                  <p className="text-left">Discuss your approach with the AI interviewer</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-blue-600">4</span>
                  </div>
                  <p className="text-left">Get real-time feedback as you code</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`rounded-xl shadow-sm ${getMessageStyle(msg.type)}`}>
                <div className="p-4">
                  {msg.type !== 'system' && msg.type !== 'error' && (
                    <div className="flex items-center space-x-2 mb-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        msg.type === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {msg.type === 'user' ? '👤' : 'AI'}
                      </div>
                      <div>
                        <span className="font-medium text-sm text-gray-900">{msg.sender}</span>
                        <span className="text-xs text-gray-500 ml-2">{formatTimestamp(msg.timestamp)}</span>
                      </div>
                    </div>
                  )}
                  <div className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap ml-10">
                    {msg.message}
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="rounded-xl shadow-sm bg-white border border-gray-200">
                <div className="p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-medium">
                      AI
                    </div>
                    <div>
                      <span className="font-medium text-sm text-gray-900">AI Interviewer</span>
                      <span className="text-xs text-gray-500 ml-2">now</span>
                    </div>
                  </div>
                  <div className="text-sm flex items-center ml-10 text-gray-600">
                    <span>Thinking about your response</span>
                    <div className="ml-3 flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="bg-white border-t border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {!isConnected ? (
                <button
                  onClick={handleStartChat}
                  disabled={status.status === 'connecting'}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <span>{status.status === 'connecting' ? 'Starting...' : 'Start Voice Chat'}</span>
                </button>
              ) : (
                <button
                  onClick={handleStopChat}
                  disabled={status.status === 'disconnecting'}
                  className="flex items-center space-x-2 bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
                  </svg>
                  <span>{status.status === 'disconnecting' ? 'Stopping...' : 'Stop Voice Chat'}</span>
                </button>
              )}
            </div>
            
            <div>
              {messages.length > 0 && (
                <button
                  onClick={handleClearMessages}
                  className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                  <span>Clear Chat</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
