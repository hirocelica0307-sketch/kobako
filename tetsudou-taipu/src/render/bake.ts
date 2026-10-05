import type { Livery, ShapeDef } from './sprites/types';

/**
 * ShapeDef × Livery を1枚のビットマップに焼いてキャッシュする。
 * 毎フレームは drawImage を呼ぶだけにする。
 */
const cache = new Map<string, HTMLCanvasElement>();

export function bake(key: string, shape: ShapeDef, livery: Livery): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const c = document.createElement('canvas');
  c.width = shape.w;
  c.height = shape.h;
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < shape.h; y++) {
    const row = shape.rows[y]!;
    for (let x = 0; x < shape.w; x++) {
      const token = row[x]!;
      if (token === '.') continue;
      const color = livery[token];
      if (color === undefined || color === 'transparent') continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  cache.set(key, c);
  return c;
}

/** 座標は必ず整数に丸める。小数だと1px滲む。 */
export function blit(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  flipX = false,
): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (!flipX) {
    ctx.drawImage(sprite, ix, iy);
    return;
  }
  ctx.save();
  ctx.translate(ix + sprite.width, iy);
  ctx.scale(-1, 1);
  ctx.drawImage(sprite, 0, 0);
  ctx.restore();
}

export function clearBakeCache(): void {
  cache.clear();
}
