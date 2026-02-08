export interface AudioSession {
  id: string;
  status: "pending" | "generating_script" | "generating_audio" | "complete" | "failed";
  voiceoverScript?: string;
  narrationPath?: string;
  musicPath?: string;
  error?: string;
}

const globalAudio = globalThis as typeof globalThis & {
  __gridion_audio?: Map<string, AudioSession>;
};

if (!globalAudio.__gridion_audio) {
  globalAudio.__gridion_audio = new Map<string, AudioSession>();
}

const sessions = globalAudio.__gridion_audio;

export function getAudioSession(id: string): AudioSession | undefined {
  return sessions.get(id);
}

export function setAudioSession(id: string, session: AudioSession): void {
  sessions.set(id, session);
}
