import type { VoiceName } from '../utils/scriptAnalysis';

export interface GeneratedTake {
  id: string;
  takeNumber: number;
  scopeLabel: string;
  text: string;
  style: string;
  voiceName: VoiceName;
  audioUrl: string;
  durationSeconds: number;
  sampleRate: number;
  byteLength: number;
  waveformPeaks: number[];
  createdAtLabel: string;
}
