/** 可复现的伪随机数发生器（xorshift128+），保证回测结果可复算 */
export class RNG {
  private s0: number; private s1: number; private s2: number; private s3: number;
  constructor(seed = 20261115) {
    let s = seed >>> 0;
    const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s; };
    this.s0 = next(); this.s1 = next(); this.s2 = next(); this.s3 = next();
  }
  next(): number {
    let t = this.s1 << 9; let r = (this.s0 * 5) >>> 0;
    r = (r << 7 | r >>> 25) >>> 0; r = (r * 9) >>> 0;
    t = (t ^ (t >>> 11)) >>> 0;
    this.s2 ^= this.s0; this.s3 ^= this.s1; this.s1 ^= this.s2; this.s0 ^= this.s3; this.s2 ^= t;
    this.s3 = (this.s3 << 21 | this.s3 >>> 11) >>> 0;
    return (r + this.s3) % 4294967296 / 4294967296;
  }
  int(max: number): number { return Math.floor(this.next() * max); }
  pick<T>(arr: T[]): T { return arr[this.int(arr.length)]; }
}

/** 加权无放回抽样：从 candidates 中按 weight 抽 k 个 */
export function weightedSample(
  candidates: number[],
  weights: number[],
  k: number,
  rng: RNG,
): number[] {
  const pool = candidates.slice();
  const w = weights.slice();
  const out: number[] = [];
  for (let t = 0; t < k && pool.length > 0; t++) {
    let total = 0;
    for (const x of w) total += x;
    if (total <= 0) { out.push(pool.splice(rng.int(pool.length), 1)[0]); w.splice(0, 1); continue; }
    let r = rng.next() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) { r -= w[idx]; if (r <= 0) break; }
    idx = Math.min(idx, pool.length - 1);
    out.push(pool[idx]);
    pool.splice(idx, 1); w.splice(idx, 1);
  }
  return out.sort((a, b) => a - b);
}
