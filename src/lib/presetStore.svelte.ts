import { tick } from "svelte";
import { api } from "./api";
import type { Preset, Project } from "./types";

/**
 * The open project's preset as edited in the UI. Edits are debounced into ordered writes scoped
 * to this project's folder; flush() waits until the backend holds exactly what the UI shows.
 */
export class PresetStore {
  preset = $state() as Preset;
  name = $state("");
  presets: string[] = $state([]);
  readonly imageDir: string;
  #toast: (t: string) => void;
  #live = true;
  #queue: Promise<void> = Promise.resolve();
  #lastWritten: string;
  #observed: string;
  #loadRevision = 0;
  #loading = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #stop: () => void;

  constructor(project: Project, toast: (t: string) => void) {
    this.imageDir = project.imageDir;
    this.#toast = toast;
    this.preset = structuredClone($state.snapshot(project.preset)) as Preset;
    this.#lastWritten = this.#observed = JSON.stringify(this.preset);
    this.#stop = $effect.root(() => {
      $effect(() => {
        const snap = $state.snapshot(this.preset) as Preset;
        const json = JSON.stringify(snap);
        if (json === this.#observed) return;
        this.#observed = json;
        clearTimeout(this.#timer);
        this.#timer = setTimeout(() => this.#enqueue(() => this.#write(snap)).catch((e) => this.#toast(String(e))), 400);
      });
    });
    api.listPresets().then((p) => { if (this.#live) this.presets = p; }).catch((e) => toast(String(e)));
  }

  destroy() {
    this.#live = false;
    clearTimeout(this.#timer);
    this.#loadRevision++;
    this.#stop();
  }

  #enqueue(work: () => Promise<void>) {
    const result = this.#queue.then(async () => {
      if (!this.#live) throw new Error("Dự án đã thay đổi");
      await work();
    });
    // Failed writes remain dirty and are retried by the next explicit flush.
    this.#queue = result.catch(() => {});
    return result;
  }

  async #write(snap: Preset) {
    const json = JSON.stringify(snap);
    if (json === this.#lastWritten) return;
    await api.setPreset(snap, this.imageDir);
    this.#lastWritten = json;
  }

  async flush(): Promise<void> {
    do {
      await tick();
      clearTimeout(this.#timer);
      if (this.#loading) await this.#queue;
      const snap = $state.snapshot(this.preset) as Preset;
      await this.#enqueue(() => this.#write(snap));
      await tick();
    } while (JSON.stringify($state.snapshot(this.preset)) !== this.#lastWritten);
    clearTimeout(this.#timer);
  }

  async save(name: string) {
    if (!name.trim()) return this.#toast("Nhập tên preset");
    await tick();
    clearTimeout(this.#timer);
    if (this.#loading) await this.#queue;
    const snap = $state.snapshot(this.preset) as Preset;
    try {
      await this.#enqueue(async () => {
        await this.#write(snap);
        if (!this.#live) throw new Error("Dự án đã thay đổi");
        await api.savePreset(name, this.imageDir);
      });
      if (!this.#live) return;
      this.name = name;
      this.#toast("Đã lưu preset");
      this.presets = await api.listPresets();
    } catch (e) { if (this.#live) this.#toast(String(e)); }
  }

  async load(name: string) {
    await tick();
    clearTimeout(this.#timer);
    const snap = $state.snapshot(this.preset) as Preset;
    const flushLocal = !this.#loading;
    const revision = ++this.#loadRevision;
    this.#loading = true;
    try {
      await this.#enqueue(async () => {
        // A second queued load must not restore the pre-load local snapshot.
        if (flushLocal) await this.#write(snap);
        if (!this.#live) throw new Error("Dự án đã thay đổi");
        const loaded = await api.loadPreset(name, this.imageDir);
        if (!this.#live || revision !== this.#loadRevision) return;
        this.#lastWritten = this.#observed = JSON.stringify(loaded);
        this.preset = loaded;
        this.name = name;
      });
    } catch (e) { if (this.#live) this.#toast(String(e)); }
    finally { if (revision === this.#loadRevision) this.#loading = false; }
  }
}
