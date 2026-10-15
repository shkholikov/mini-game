import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { TEXT } from '../i18n/ru';
import { save } from '../systems/services';
import { SongPlayer, loadSong, removeSong, saveSong } from '../systems/song';
import { HOLD_TO_EXIT_MS, HonkGate } from '../systems/tractorLogic';
import { voice } from '../systems/voice';
import { TractorWorld, type Barn } from '../three/TractorWorld';
import { getStage, rayFromGame } from '../three/stage';
import { COLOR, candyButton, gameText, hearts, holdButton, iconButton } from '../ui';

/** Fingers a toddler may put on the screen at once (Phaser starts with fewer). */
const POINTERS = 6;
/** The parent panel closes by itself after this long. */
const PANEL_MS = 20_000;

/**
 * Умар (1.5): a toy, not a game. Any tap honks the blue tractor; tapping an animal makes it jump
 * and say its name; every few animals the tractor stops at a barn for peekaboo. No goals, no end.
 * Holding home for 2 s opens a parent panel (leave, add or remove the background song).
 */
export class TractorScene extends Phaser.Scene {
  private world!: TractorWorld;
  private readonly song = new SongPlayer();
  private gate = new HonkGate();
  private busy = false;
  private honks = 0;
  private talking = 0;
  private panel: Phaser.GameObjects.Container | null = null;
  private status: Phaser.GameObjects.Text | null = null;
  private fileInput: HTMLInputElement | null = null;

  constructor() {
    super('Tractor');
  }

  create(): void {
    this.world = new TractorWorld();
    const stage = getStage();
    stage.show(this.world.scene, this.world.camera);
    this.busy = false;
    this.honks = 0;
    this.talking = 0;
    this.panel = null;
    this.gate = new HonkGate();
    this.events.once('shutdown', () => {
      stage.hide();
      this.song.stop();
      this.fileInput?.remove();
      this.fileInput = null;
    });

    const missing = POINTERS - this.input.manager.pointersTotal;
    if (missing > 0) this.input.addPointer(missing);
    holdButton(this, 'home', COLOR.orange, HOLD_TO_EXIT_MS, () => this.openPanel());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (!this.panel && over.length === 0) this.tap(p);
    });
    // Browsers only allow sound to start from a touch; retry the song on every tap.
    this.input.on('pointerup', () => this.song.resume());

    save.update((p) => void (p.umar.rides += 1));
    void this.song.start();
  }

  update(_time: number, deltaMs: number): void {
    this.world.update(Math.min(deltaMs, 50) / 1000);
    if (!this.busy) {
      const barn = this.world.takeBarnStop();
      if (barn) void this.peekaboo(barn);
    }
    getStage().render();
  }

  private tap(p: Phaser.Input.Pointer): void {
    const ray = rayFromGame(getStage(), p.x, p.y, this.game.canvas, GAME_WIDTH, GAME_HEIGHT);
    const animal = this.world.pickAnimal(ray);
    if (animal) {
      if (animal.busy) return;
      voice().sfx('pop');
      void this.world.cheer(animal);
      void this.say(`name_${animal.id}`, `snd_${animal.id}`);
      return;
    }
    if (!this.gate.tryHonk(this.time.now)) return;
    voice().sfx('horn', 0.8);
    this.world.honk();
    this.honks += 1;
    if (this.honks % 4 === 0) void this.say('bibi');
  }

  /** Voice lines with the song turned down meanwhile. */
  private async say(...ids: string[]): Promise<void> {
    this.talking += 1;
    this.song.duck(true);
    try {
      await voice().say(...ids);
    } finally {
      this.talking -= 1;
      if (this.talking === 0) this.song.duck(false);
    }
  }

  private async peekaboo(barn: Barn): Promise<void> {
    this.busy = true;
    await this.say('peek');
    voice().sfx('whoosh', 0.5);
    const animal = await this.world.openBarn(barn);
    voice().sfx('correct');
    const at = getStage().toGame(
      animal.group.position.clone().setY(2.2),
      this.game.canvas,
      GAME_WIDTH,
      GAME_HEIGHT,
    );
    hearts(this, at.x, at.y, 10);
    await this.say('kuku', `name_${animal.id}`, `snd_${animal.id}`);
    await new Promise((r) => this.time.delayedCall(500, r));
    this.world.go();
    this.busy = false;
  }

  /** Parent panel: home, add a song from the tablet, remove it, or back to the tractor. */
  private openPanel(): void {
    if (this.panel) return;
    const c = this.add.container(0, 0).setDepth(200);
    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55)
      .setInteractive();
    const card = this.add.graphics();
    card.fillStyle(0x000000, 0.2).fillRoundedRect(330, 222, 940, 500, 48);
    card.fillStyle(0xffffff, 1).fillRoundedRect(330, 210, 940, 500, 48);
    this.status = gameText(this, 800, 290, '', 'label', { size: 40 });
    c.add([dim, card, this.status]);
    void this.showSongStatus();

    const song = candyButton(this, 600, 440, {
      width: 380,
      height: 120,
      color: COLOR.blue,
      icon: 'musicOn',
      label: TEXT.parentSong,
      fontSize: 44,
      onTap: () => undefined,
    });
    // The file picker must open inside the touch itself, not after the button animation.
    song.on('pointerup', () => this.pickSong());
    const remove = candyButton(this, 1000, 440, {
      width: 380,
      height: 120,
      color: COLOR.pink,
      icon: 'musicOff',
      label: TEXT.parentNoSong,
      fontSize: 34,
      onTap: () => void this.dropSong(),
    });
    const home = iconButton(this, 640, 600, 'home', COLOR.orange, () => {
      voice().stop();
      this.scene.start('Title');
    });
    const back = iconButton(this, 960, 600, 'right', COLOR.green, () => this.closePanel());
    c.add([song, remove, home, back]);
    this.panel = c;
    this.time.delayedCall(PANEL_MS, () => {
      if (this.panel === c) this.closePanel();
    });
  }

  private closePanel(): void {
    this.panel?.destroy();
    this.panel = null;
    this.status = null;
  }

  private async showSongStatus(): Promise<void> {
    const has = (await loadSong()) !== null;
    this.status?.setText(has ? TEXT.parentSongOn : TEXT.parentSongOff);
  }

  private pickSong(): void {
    if (!this.fileInput) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*,.mp3,.m4a';
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        input.value = '';
        if (file) void this.useSong(file);
      });
      document.body.append(input);
      this.fileInput = input;
    }
    this.fileInput.click();
  }

  private async useSong(file: File): Promise<void> {
    try {
      await saveSong(file);
      await this.song.start();
      voice().sfx('correct');
    } catch (e) {
      console.warn('[song] could not save the song', e);
    }
    await this.showSongStatus();
  }

  private async dropSong(): Promise<void> {
    this.song.stop();
    try {
      await removeSong();
    } catch (e) {
      console.warn('[song] could not remove the song', e);
    }
    await this.showSongStatus();
  }
}
