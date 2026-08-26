/** Minimal QR (byte mode, ECC M) for referral links. */
const ECC_TABLE = [
  [10, 7],
  [16, 10],
  [26, 15],
  [36, 20],
  [44, 26],
  [64, 36],
  [86, 40],
  [108, 48],
];

function gfMul(a: number, b: number) {
  if (!a || !b) return 0;
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1d;
    b >>= 1;
  }
  return p;
}

function rsRemainder(data: number[], nsym: number) {
  const gen = [1];
  let x = 1;
  for (let i = 0; i < nsym; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], x);
    }
    gen.splice(0, gen.length, ...next);
    let n = x << 1;
    if (n & 0x100) n ^= 0x11d;
    x = n & 0xff;
  }
  const res = new Array(nsym).fill(0);
  for (const b of data) {
    const factor = b ^ res[0];
    res.shift();
    res.push(0);
    for (let i = 0; i < nsym; i++) res[i] ^= gfMul(gen[i + 1] ?? 0, factor);
  }
  return res;
}

function bitPush(bits: number[], val: number, len: number) {
  for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
}

export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  let dataCodewords = 16;
  let eccLen = 10;
  for (let v = 1; v <= 8; v++) {
    const [total, ecc] = ECC_TABLE[v - 1]!;
    const cap = total - ecc;
    const need = Math.ceil((4 + 8 + bytes.length * 8 + 4) / 8);
    if (need <= cap) {
      ver = v;
      dataCodewords = cap;
      eccLen = ecc;
      break;
    }
  }
  const bits: number[] = [];
  bitPush(bits, 0b0100, 4);
  bitPush(bits, bytes.length, 8);
  for (const b of bytes) bitPush(bits, b, 8);
  bitPush(bits, 0, Math.min(4, dataCodewords * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] ?? 0);
    data.push(b);
  }
  const pad = [0xec, 0x11];
  let p = 0;
  while (data.length < dataCodewords) data.push(pad[p++ % 2]!);
  const ecc = rsRemainder(data.slice(0, dataCodewords), eccLen);
  const code = data.slice(0, dataCodewords).concat(ecc);
  const size = 17 + 4 * ver;
  const m: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  const placeFinder = (r: number, c: number) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const rr = r + y;
        const cc = c + x;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const on =
          x === -1 ||
          y === -1 ||
          x === 7 ||
          y === 7
            ? false
            : x === 0 || y === 0 || x === 6 || y === 6
              ? true
              : x >= 2 && x <= 4 && y >= 2 && y <= 4;
        m[rr]![cc] = on;
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) {
    m[6]![i] = i % 2 === 0;
    m[i]![6] = i % 2 === 0;
  }
  m[size - 8]![8] = true;

  let bit = 0;
  const totalBits = code.length * 8;
  const getBit = (i: number) => {
    const b = code[Math.floor(i / 8)] ?? 0;
    return ((b >> (7 - (i % 8))) & 1) === 1;
  };
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let y = 0; y < size; y++) {
      const up = ((size - 1 - col) / 2) % 2 === 0;
      const row = up ? size - 1 - y : y;
      for (let dx = 0; dx < 2; dx++) {
        const c = col - dx;
        if (m[row]![c] != null) continue;
        let dark = bit < totalBits ? getBit(bit) : false;
        bit++;
        if (((row + c) % 2) === 0) dark = !dark;
        m[row]![c] = dark;
      }
    }
  }
  return m.map((row) => row.map((v) => Boolean(v)));
}
