import { DEFAULT_VOICE_STYLE, type VoiceName } from './scriptAnalysis';

export interface StudioDraft {
  scriptText: string;
  stylePrompt: string;
  voiceName: VoiceName;
  autoProsody: boolean;
}

export function createEmptyDraft(): StudioDraft {
  return {
    scriptText: '',
    stylePrompt: DEFAULT_VOICE_STYLE,
    voiceName: 'Puck',
    autoProsody: true,
  };
}
