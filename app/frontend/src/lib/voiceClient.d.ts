// Global type definitions
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
}

// Global window extension
declare global {
  interface Window {
    LeetSpeakVoiceClient: typeof LeetSpeakVoiceClient;
  }
}