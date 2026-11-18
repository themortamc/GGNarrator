import type { GeneratedTake } from '../types/studio';
import { extractWaveformPeaksFromWavBytes } from './audioWaveform';
import { createEmptyDraft, type StudioDraft } from './scriptLibrary';

const DRAFT_STORAGE_KEY = 'mortups_studio_draft_v2';
const IDB_NAME = 'mortups_tts_studio_db';
const IDB_STORE = 'takes';
const IDB_VERSION = 1;

interface PersistedTakeRecord {
  id: string;
  scriptId: string;
  takeNumber: number;
  scopeLabel: string;
  blockIndex: number | null;
  text: string;
  style: string;
  voiceName: GeneratedTake['voiceName'];
  wavBuffer: ArrayBuffer;
  durationSeconds: number;
  sampleRate: number;
  byteLength: number;
  waveformPeaks: number[];
  createdAtLabel: string;
  isApproved: boolean;
  kind?: GeneratedTake['kind'];
  savedAt: number;
}

export function loadStudioDraft(): StudioDraft {
  const fallback = createEmptyDraft();
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<StudioDraft>;
    return {
      scriptText: typeof parsed.scriptText === 'string' ? parsed.scriptText : '',
      stylePrompt:
        typeof parsed.stylePrompt === 'string' && parsed.stylePrompt.trim()
          ? parsed.stylePrompt
          : fallback.stylePrompt,
      voiceName: parsed.voiceName ?? fallback.voiceName,
      autoProsody: parsed.autoProsody ?? true,
    };
  } catch {
    return fallback;
  }
}

export function saveStudioDraft(draft: StudioDraft): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveTakeToStorage(take: GeneratedTake): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    return;
  }
  const copy = new Uint8Array(take.wavBytes.byteLength);
  copy.set(take.wavBytes);
  const record: PersistedTakeRecord = {
    id: take.id,
    scriptId: take.scriptId,
    takeNumber: take.takeNumber,
    scopeLabel: take.scopeLabel,
    blockIndex: take.blockIndex,
    text: take.text,
    style: take.style,
    voiceName: take.voiceName,
    wavBuffer: copy.buffer,
    durationSeconds: take.durationSeconds,
    sampleRate: take.sampleRate,
    byteLength: take.byteLength,
    waveformPeaks: take.waveformPeaks,
    createdAtLabel: take.createdAtLabel,
    isApproved: take.isApproved,
    kind: take.kind,
    savedAt: Date.now(),
  };

  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
}

export async function loadTakesFromStorage(): Promise<GeneratedTake[]> {
  const db = await openDatabase();
  if (!db) {
    return [];
  }
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => {
      const records = (req.result as PersistedTakeRecord[]) ?? [];
      records.sort((a, b) => b.savedAt - a.savedAt);
      const takes: GeneratedTake[] = records.map((rec) => {
        const wavBytes = new Uint8Array(rec.wavBuffer);
        const blob = new Blob([wavBytes.buffer as ArrayBuffer], {
          type: 'audio/wav',
        });
        const audioUrl = URL.createObjectURL(blob);
        return {
          id: rec.id,
          scriptId: rec.scriptId,
          takeNumber: rec.takeNumber,
          scopeLabel: rec.scopeLabel,
          blockIndex: rec.blockIndex ?? null,
          text: rec.text,
          style: rec.style,
          voiceName: rec.voiceName,
          audioUrl,
          wavBytes,
          durationSeconds: rec.durationSeconds,
          sampleRate: rec.sampleRate,
          byteLength: rec.byteLength,
          waveformPeaks:
            rec.waveformPeaks?.length > 0
              ? rec.waveformPeaks
              : extractWaveformPeaksFromWavBytes(wavBytes, 56),
          createdAtLabel: rec.createdAtLabel,
          isApproved: Boolean(rec.isApproved),
          kind: rec.kind,
        };
      });
      db.close();
      resolve(takes);
    };
    req.onerror = () => {
      db.close();
      resolve([]);
    };
  });
}

export async function deleteTakeFromStorage(takeId: string): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(takeId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
}
