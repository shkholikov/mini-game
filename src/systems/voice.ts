import type Phaser from 'phaser';

/**
 * Plays voice lines by id (files in public/assets/voice). A new line interrupts the previous one.
 * A missing file is skipped with console.warn — the game never breaks because of audio.
 */
export class Voice {
  private current: Phaser.Sound.BaseSound | null = null;
  private token = 0;

  constructor(private readonly game: Phaser.Game) {}

  async say(...ids: string[]): Promise<void> {
    const my = ++this.token;
    this.stopCurrent();
    if (this.game.sound.locked)
      await new Promise<void>((r) => this.game.sound.once('unlocked', () => r()));
    for (const id of ids) {
      if (my !== this.token) return;
      await this.playOne(`v_${id}`);
    }
  }

  stop(): void {
    this.token++;
    this.stopCurrent();
  }

  sfx(key: string, volume = 0.6): void {
    if (!this.game.cache.audio.exists(`sfx_${key}`)) {
      console.warn(`[voice] missing sound sfx_${key}`);
      return;
    }
    this.game.sound.play(`sfx_${key}`, { volume });
  }

  private playOne(key: string): Promise<void> {
    if (!this.game.cache.audio.exists(key)) {
      console.warn(`[voice] missing voice ${key}`);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const s = this.game.sound.add(key);
      this.current = s;
      const done = (): void => {
        if (this.current === s) this.current = null;
        s.destroy();
        resolve();
      };
      s.once('complete', done);
      s.once('stop', done);
      s.play();
    });
  }

  private stopCurrent(): void {
    this.current?.stop();
    this.current = null;
  }
}

let instance: Voice | null = null;

export function initVoice(game: Phaser.Game): Voice {
  instance = new Voice(game);
  return instance;
}

export function voice(): Voice {
  if (!instance) throw new Error('Voice not initialised');
  return instance;
}
