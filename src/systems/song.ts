/**
 * Умар's background song. The file is never part of the game build: a parent picks an mp3 on the
 * tablet once (parent panel in the tractor mode) and it is kept in this browser's IndexedDB.
 */
const DB_NAME = 'mini-game';
const STORE = 'files';
const KEY = 'tractor-song';
const VOLUME = 0.55;
const DUCKED = 0.15;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('indexedDB request failed'));
    });
  } finally {
    db.close();
  }
}

export async function loadSong(): Promise<Blob | null> {
  try {
    const blob = await run<Blob | undefined>('readonly', (s) => s.get(KEY));
    return blob ?? null;
  } catch (e) {
    console.warn('[song] could not read the song', e);
    return null;
  }
}

export function saveSong(file: Blob): Promise<IDBValidKey> {
  return run('readwrite', (s) => s.put(file, KEY));
}

export function removeSong(): Promise<undefined> {
  return run('readwrite', (s) => s.delete(KEY));
}

/** Loops the stored song with an <audio> element (streams, so a long mp3 doesn't fill memory). */
export class SongPlayer {
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;
  private held = false;
  /** bumped by stop(), so a start() still loading the file gives up */
  private generation = 0;

  /** Starts the stored song, if there is one. Returns false when no song was added. */
  async start(): Promise<boolean> {
    this.stop();
    const my = this.generation;
    const blob = await loadSong();
    if (!blob || my !== this.generation) return false;
    this.url = URL.createObjectURL(blob);
    this.audio = new Audio(this.url);
    this.audio.loop = true;
    this.audio.volume = VOLUME;
    setActive(this);
    return true;
  }

  get playing(): boolean {
    return Boolean(this.audio && !this.audio.paused);
  }

  /** Browsers start sound only after a touch, so the scene calls this again on taps. */
  resume(): void {
    if (this.audio?.paused && !this.held) void this.audio.play().catch(() => undefined);
  }

  /** Paused while the tablet is upright or the page is hidden. */
  hold(on: boolean): void {
    this.held = on;
    if (on) this.audio?.pause();
    else this.resume();
  }

  /** Quieter while the voice is talking. */
  duck(on: boolean): void {
    if (this.audio) this.audio.volume = on ? DUCKED : VOLUME;
  }

  stop(): void {
    this.generation += 1;
    this.audio?.pause();
    if (this.audio) this.audio.src = '';
    this.audio = null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    if (active === this) setActive(null);
  }
}

let active: SongPlayer | null = null;
let portrait = false;

const sync = (): void => active?.hold(portrait || document.hidden);

function setActive(player: SongPlayer | null): void {
  active = player;
  sync();
}
document.addEventListener('visibilitychange', sync);

/** Called by main.ts when the tablet is turned upright or back. */
export function setSongPortrait(on: boolean): void {
  portrait = on;
  sync();
}
