// Module declaration for voiceClient.js
declare module '../../lib/voiceClient.js' {
  class LeetSpeakVoiceClient {
    constructor();
    startVoiceChat(config?: any): Promise<{ sessionId: string }>;
    stopVoiceChat(): Promise<void>;
    onStatusChange: ((status: any) => void) | null;
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
  
  export default LeetSpeakVoiceClient;
  export { LeetSpeakVoiceClient };
}

declare module './voiceClient.js' {
  export * from '../../lib/voiceClient.js';
  export { default } from '../../lib/voiceClient.js';
}