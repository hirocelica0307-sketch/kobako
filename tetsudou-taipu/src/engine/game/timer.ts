/**
 * performance.now() ベースの実時間タイマー。
 * rAF の delta 積算はタブが非アクティブになると壊れるので使わない。
 */
export class RunTimer {
  private accumulated = 0;
  private startedAt: number | null = null;

  start(now = performance.now()): void {
    if (this.startedAt === null) this.startedAt = now;
  }

  pause(now = performance.now()): void {
    if (this.startedAt !== null) {
      this.accumulated += now - this.startedAt;
      this.startedAt = null;
    }
  }

  get running(): boolean {
    return this.startedAt !== null;
  }

  elapsedMs(now = performance.now()): number {
    return this.accumulated + (this.startedAt === null ? 0 : now - this.startedAt);
  }

  elapsedSec(now = performance.now()): number {
    return this.elapsedMs(now) / 1000;
  }

  reset(): void {
    this.accumulated = 0;
    this.startedAt = null;
  }
}
