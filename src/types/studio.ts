import type { VoiceName } from '../utils/scriptAnalysis';

export interface GeneratedTake {
  id: string;
  scriptId: string;
  takeNumber: number;
  scopeLabel: string;
  blockIndex: number | null;
  text: string;
  style: string;
  voiceName: VoiceName;
  audioUrl: string;
  wavBytes: Uint8Array;
  durationSeconds: number;
  sampleRate: number;
  byteLength: number;
  waveformPeaks: number[];
  createdAtLabel: string;
  isApproved: boolean;
  kind?: 'full' | 'block' | 'master' | 'mixed';
}
