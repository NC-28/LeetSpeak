// Global type definitions
interface VoiceMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

interface SessionConfig {
  voice: string;
  temperature: number;
  instructions: string;
}

interface StatusInfo {
  status: string;
  text: string;
}

declare class LeetSpeakVoiceClient {
  constructor();
  startVoiceChat(config?: any): Promise<{ sessionId: string }>;
  stopVoiceChat(): Promise<void>;
  onStatusChange: ((status: StatusInfo) => void) | null;
  onMessage: ((message: any) => void) | null;
  onTranscript: ((transcript: any) => void) | null;
  onError: ((error: Error) => void) | null;
  setVolume(volume: number): void;
  isMuted(): boolean;
  toggleMute(): void;
  getSessionStatus(): Promise<string>;
  clearMessages(): void;
  destroy(): void;
}

// Global window extension
declare global {
  interface Window {
    LeetSpeakVoiceClient: typeof LeetSpeakVoiceClient;
  }
}