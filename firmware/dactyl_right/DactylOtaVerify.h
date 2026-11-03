#pragma once
/*
 * DactylOtaVerify.h — Kompakte Ed25519-Signaturprüfung für BLE-OTA-Updates.
 *
 * Prüft den SHA-512/Ed25519-Nachweis des empfangenen Firmware-Images streamingweise,
 * sodass während des Transfers nur ein kleiner Hash-Zustand im RAM liegt (~250 Bytes).
 * Basiert auf TweetNaCl (public domain).
 */

#include <stdint.h>
#include <stddef.h>
#include <string.h>

namespace dactyl_ota {

typedef int64_t gf[16];

static const uint8_t iv[64] = {
  0x6a,0x09,0xe6,0x67,0xf3,0xbc,0xc9,0x08,
  0xbb,0x67,0xae,0x85,0x84,0xca,0xa7,0x3b,
  0x3c,0x6e,0xf3,0x72,0xfe,0x94,0xf8,0x2b,
  0xa5,0x4f,0xf5,0x3a,0x5f,0x1d,0x36,0xf1,
  0x51,0x0e,0x52,0x7f,0xad,0xe6,0x82,0xd1,
  0x9b,0x05,0x68,0x8c,0x2b,0x3e,0x6c,0x1f,
  0x1f,0x83,0xd9,0xab,0xfb,0x41,0xbd,0x6b,
  0x5b,0xe0,0xcd,0x19,0x13,0x7e,0x21,0x79
};

static const uint8_t sigma16[16] = {
  'e','x','p','a','n','d',' ','3','2','-','b','y','t','e',' ','k'
};

static const gf gf0 = {0};
static const gf gf1 = {1};
static const gf _121665 = {0xDB41,1};
static const gf D = {0x78a3, 0x1359, 0x4dca, 0x75eb, 0xd8ab, 0x4141, 0x0a4d, 0x0070, 0xe898, 0x7779, 0x4079, 0x8cc7, 0xfe73, 0x2b6f, 0x6cee, 0x5203};
static const gf D2 = {0xf159, 0x26b2, 0x9b94, 0xebd6, 0xb156, 0x8283, 0x149a, 0x00e0, 0xd130, 0xeef3, 0x80f2, 0x198e, 0xfce7, 0x56df, 0xd9dc, 0x2406};
static const gf X = {0xd51a, 0x8f25, 0x2d60, 0xc956, 0xa7b2, 0x9525, 0xc760, 0x692c, 0xdc5c, 0xfdd6, 0xe231, 0xc0a4, 0x53fe, 0xcd6e, 0x36d3, 0x2169};
static const gf Y = {0x6658, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666};
static const gf I = {0xa0b0, 0x4a0e, 0x1b27, 0xc4ee, 0xe478, 0xad2f, 0x1806, 0x2f43, 0xd7a7, 0x3dfb, 0x0099, 0x2b4d, 0xdf0b, 0x4fc1, 0x2480, 0x2b83};

static inline void set25519(gf r, const gf a) {
  for (int i = 0; i < 16; i++) r[i] = a[i];
}

static inline void car25519(gf o) {
  for (int i = 0; i < 16; i++) {
    o[i] += (1LL << 16);
    int64_t c = o[i] >> 16;
    o[(i + 1) * (i < 15)] += c - 1 + 37 * (c - 1) * (i == 15);
    o[i] -= c << 16;
  }
}

static inline void sel25519(gf p, gf q, int b) {
  int64_t c = ~(b - 1);
  for (int i = 0; i < 16; i++) {
    int64_t t = c & (p[i] ^ q[i]);
    p[i] ^= t;
    q[i] ^= t;
  }
}

static inline void pack25519(uint8_t *o, const gf n) {
  gf m, t;
  set25519(t, n);
  car25519(t);
  car25519(t);
  car25519(t);
  for (int j = 0; j < 2; j++) {
    m[0] = t[0] - 0xffed;
    for (int i = 1; i < 15; i++) {
      m[i] = t[i] - 0xffff - ((m[i - 1] >> 16) & 1);
      m[i - 1] &= 0xffff;
    }
    m[15] = t[15] - 0x7fff - ((m[14] >> 16) & 1);
    int b = (int)((m[15] >> 16) & 1);
    m[14] &= 0xffff;
    sel25519(t, m, 1 - b);
  }
  for (int i = 0; i < 16; i++) {
    o[2 * i] = (uint8_t)t[i];
    o[2 * i + 1] = (uint8_t)(t[i] >> 8);
  }
}

static inline int neq25519(const gf a, const gf b) {
  uint8_t c[32], d[32];
  pack25519(c, a);
  pack25519(d, b);
  uint8_t diff = 0;
  for (int i = 0; i < 32; i++) diff |= (c[i] ^ d[i]);
  return (1 & ((diff - 1) >> 8)) - 1;
}

static inline uint8_t par25519(const gf a) {
  uint8_t d[32];
  pack25519(d, a);
  return d[0] & 1;
}

static inline void unpack25519(gf o, const uint8_t *n) {
  for (int i = 0; i < 16; i++) {
    o[i] = (int64_t)n[2 * i] + ((int64_t)n[2 * i + 1] << 8);
  }
  o[15] &= 0x7fff;
}

static inline void A(gf o, const gf a, const gf b) {
  for (int i = 0; i < 16; i++) o[i] = a[i] + b[i];
}

static inline void Z(gf o, const gf a, const gf b) {
  for (int i = 0; i < 16; i++) o[i] = a[i] - b[i];
}

static inline void M(gf o, const gf a, const gf b) {
  int64_t t[31] = {0};
  for (int i = 0; i < 16; i++) {
    for (int j = 0; j < 16; j++) {
      t[i + j] += a[i] * b[j];
    }
  }
  for (int i = 0; i < 15; i++) {
    t[i] += 38 * t[i + 16];
  }
  for (int i = 0; i < 16; i++) o[i] = t[i];
  car25519(o);
  car25519(o);
}

static inline void S(gf o, const gf a) {
  M(o, a, a);
}

static inline void inv25519(gf o, const gf i) {
  gf c;
  for (int a = 0; a < 16; a++) c[a] = i[a];
  for (int a = 253; a >= 0; a--) {
    S(c, c);
    if (a != 2 && a != 4) M(c, c, i);
  }
  for (int a = 0; a < 16; a++) o[a] = c[a];
}

static inline void pow2523(gf o, const gf i) {
  gf c;
  for (int a = 0; a < 16; a++) c[a] = i[a];
  for (int a = 250; a >= 0; a--) {
    S(c, c);
    if (a != 1) M(c, c, i);
  }
  for (int a = 0; a < 16; a++) o[a] = c[a];
}

static inline uint64_t dl64(const uint8_t *x) {
  uint64_t r = 0;
  for (int i = 0; i < 8; i++) r = (r << 8) | x[i];
  return r;
}

static inline void ts64(uint8_t *x, uint64_t u) {
  for (int i = 7; i >= 0; --i) {
    x[i] = (uint8_t)u;
    u >>= 8;
  }
}

static inline uint64_t R(uint64_t x, int c) {
  return (x >> c) | (x << (64 - c));
}

static inline uint64_t Ch(uint64_t x, uint64_t y, uint64_t z) {
  return (x & y) ^ (~x & z);
}

static inline uint64_t Maj(uint64_t x, uint64_t y, uint64_t z) {
  return (x & y) ^ (x & z) ^ (y & z);
}

static inline uint64_t Sigma0(uint64_t x) {
  return R(x, 28) ^ R(x, 34) ^ R(x, 39);
}

static inline uint64_t Sigma1(uint64_t x) {
  return R(x, 14) ^ R(x, 18) ^ R(x, 41);
}

static inline uint64_t sigma0(uint64_t x) {
  return R(x, 1) ^ R(x, 8) ^ (x >> 7);
}

static inline uint64_t sigma1(uint64_t x) {
  return R(x, 19) ^ R(x, 61) ^ (x >> 6);
}

static const uint64_t K[80] = {
  0x428a2f98d728ae22ULL, 0x7137449123ef65cdULL, 0xb5c0fbcfec4d3b2fULL, 0xe9b5dba58189dbbcULL,
  0x3956c25bf348b538ULL, 0x59f111f1b605d019ULL, 0x923f82a4af194f9bULL, 0xab1c5ed5da6d8118ULL,
  0xd807aa98a3030242ULL, 0x12835b0145706fbeULL, 0x243185be4ee4b28cULL, 0x550c7dc3d5ffb4e2ULL,
  0x72be5d74f27b896fULL, 0x80deb1fe3b1696b1ULL, 0x9bdc06a725c71235ULL, 0xc19bf174cf692694ULL,
  0xe49b69c19ef14ad2ULL, 0xefbe4786384f25e3ULL, 0x0fc19dc68b8cd5b5ULL, 0x240ca1cc77ac9c65ULL,
  0x2de92c6f592b0275ULL, 0x4a7484aa6ea6e483ULL, 0x5cb0a9dcbd41fbd4ULL, 0x76f988da831153b5ULL,
  0x983e5152ee66dfabULL, 0xa831c66d2db43210ULL, 0xb00327c898fb213fULL, 0xbf597fc7beef0ee4ULL,
  0xc6e00bf33da88fc2ULL, 0xd5a79147930aa725ULL, 0x06ca6351e003826fULL, 0x142929670a0e6e70ULL,
  0x27b70a8546d22ffcULL, 0x2e1b21385c26c926ULL, 0x4d2c6dfc5ac42aedULL, 0x53380d139d95b3dfULL,
  0x650a73548baf63deULL, 0x766a0abb3c77b2a8ULL, 0x81c2c92e47edaee6ULL, 0x92722c851482353bULL,
  0xa2bfe8a14cf10364ULL, 0xa81a664bbc423001ULL, 0xc24b8b70d0f89791ULL, 0xc76c51a30654be30ULL,
  0xd192e819d6ef5218ULL, 0xd69906245565a910ULL, 0xf40e35855771202aULL, 0x106aa07032bbd1b8ULL,
  0x19a4c116b8d2d0c8ULL, 0x1e376c085141ab53ULL, 0x2748774cdf8eeb99ULL, 0x34b0bcb5e19b48a8ULL,
  0x391c0cb3c5c95a63ULL, 0x4ed8aa4ae3418acbULL, 0x5b9cca4f7763e373ULL, 0x682e6ff3d6b2b8a3ULL,
  0x748f82ee5defb2fcULL, 0x78a5636f43172f60ULL, 0x84c87814a1f0ab72ULL, 0x8cc702081a6439ecULL,
  0x90befffa23631e28ULL, 0xa4506cebde82bde9ULL, 0xbef9a3f7b2c67915ULL, 0xc67178f2e372532bULL,
  0xca273eceea26619cULL, 0xd186b8c721c0c207ULL, 0xeada7dd6cde0eb1eULL, 0xf57d4f7fee6ed178ULL,
  0x06f067aa72176fbaULL, 0x0a637dc5a2c898a6ULL, 0x113f9804bef90daeULL, 0x1b710b35131c471bULL,
  0x28db77f523047d84ULL, 0x32caab7b40c72493ULL, 0x3c9ebe0a15c9bebcULL, 0x431d67c49c100d4cULL,
  0x4cc5d4becb3e42b6ULL, 0x597f299cfc657e2aULL, 0x5fcb6fab3ad6faecULL, 0x6c44198c4a475817ULL
};

static inline void hashblocks_sha512(uint8_t *x, const uint8_t *m, uint64_t n) {
  uint64_t z[8], b[8], a[8], w[16], t;

  for (int i = 0; i < 8; i++) z[i] = a[i] = dl64(x + 8 * i);

  while (n >= 128) {
    for (int i = 0; i < 16; i++) w[i] = dl64(m + 8 * i);

    for (int i = 0; i < 80; i++) {
      for (int j = 0; j < 8; j++) b[j] = a[j];
      t = a[7] + Sigma1(a[4]) + Ch(a[4], a[5], a[6]) + K[i] + w[i % 16];
      b[7] = t + Sigma0(a[0]) + Maj(a[0], a[1], a[2]);
      b[3] += t;
      for (int j = 0; j < 8; j++) a[(j + 1) % 8] = b[j];
      if (i % 16 == 15) {
        for (int j = 0; j < 16; j++) {
          w[j] += w[(j + 9) % 16] + sigma0(w[(j + 1) % 16]) + sigma1(w[(j + 14) % 16]);
        }
      }
    }

    for (int i = 0; i < 8; i++) {
      a[i] += z[i];
      z[i] = a[i];
    }

    m += 128;
    n -= 128;
  }

  for (int i = 0; i < 8; i++) ts64(x + 8 * i, z[i]);
}

static inline void add(gf p[4], gf q[4]) {
  gf a, b, c, d, t, e, f, g, h;
  Z(a, p[1], p[0]);
  Z(t, q[1], q[0]);
  M(a, a, t);
  A(b, p[0], p[1]);
  A(t, q[0], q[1]);
  M(b, b, t);
  M(c, p[3], q[3]);
  M(c, c, D2);
  M(d, p[2], q[2]);
  A(d, d, d);
  Z(e, b, a);
  Z(f, d, c);
  A(g, d, c);
  A(h, b, a);
  M(p[0], e, f);
  M(p[1], h, g);
  M(p[2], g, f);
  M(p[3], e, h);
}

static inline void cswap(gf p[4], gf q[4], uint8_t b) {
  for (int i = 0; i < 4; i++) {
    sel25519(p[i], q[i], b);
  }
}

static inline void pack(uint8_t *r, gf p[4]) {
  gf tx, ty, zi;
  inv25519(zi, p[2]);
  M(tx, p[0], zi);
  M(ty, p[1], zi);
  pack25519(r, ty);
  r[31] ^= par25519(tx) << 7;
}

static inline void scalarmult(gf p[4], gf q[4], const uint8_t *s) {
  set25519(p[0], gf0);
  set25519(p[1], gf1);
  set25519(p[2], gf1);
  set25519(p[3], gf0);
  for (int i = 255; i >= 0; --i) {
    uint8_t b = (s[i / 8] >> (i & 7)) & 1;
    cswap(p, q, b);
    add(q, p);
    add(p, p);
    cswap(p, q, b);
  }
}

static inline void scalarbase(gf p[4], const uint8_t *s) {
  gf q[4];
  set25519(q[0], X);
  set25519(q[1], Y);
  set25519(q[2], gf1);
  M(q[3], X, Y);
  scalarmult(p, q, s);
}

static const int64_t L[32] = {
  0xed, 0xd3, 0xf5, 0x5c, 0x1a, 0x63, 0x12, 0x58,
  0xd6, 0x9c, 0xf7, 0xa2, 0xde, 0xf9, 0xde, 0x14,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10
};

static inline void modL(uint8_t *r, int64_t x[64]) {
  int64_t carry;
  for (int i = 63; i >= 32; --i) {
    carry = 0;
    for (int j = i - 32; j < i - 12; ++j) {
      x[j] += carry - 16 * x[i] * L[j - (i - 32)];
      carry = (x[j] + 128) >> 8;
      x[j] -= carry << 8;
    }
    x[i - 12] += carry;
    x[i] = 0;
  }
  carry = 0;
  for (int j = 0; j < 32; ++j) {
    x[j] += carry - (x[31] >> 4) * L[j];
    carry = x[j] >> 8;
    x[j] &= 255;
  }
  for (int j = 0; j < 32; ++j) x[j] -= carry * L[j];
  for (int i = 0; i < 32; ++i) {
    x[i + 1] += x[i] >> 8;
    r[i] = (uint8_t)(x[i] & 255);
  }
}

static inline void reduce(uint8_t *r) {
  int64_t x[64];
  for (int i = 0; i < 64; i++) x[i] = (uint64_t)r[i];
  for (int i = 0; i < 64; i++) r[i] = 0;
  modL(r, x);
}

static inline int unpackneg(gf r[4], const uint8_t p[32]) {
  gf num, den, den2, den4, den6, t, chk;
  set25519(r[2], gf1);
  unpack25519(r[1], p);
  S(num, r[1]);
  M(den, num, D);
  Z(num, num, r[2]);
  A(den, r[2], den);

  S(den2, den);
  S(den4, den2);
  M(den6, den4, den2);
  M(t, den6, num);
  M(t, t, den);

  pow2523(t, t);
  M(t, t, num);
  M(t, t, den);
  M(t, t, den);
  M(r[0], t, den);

  S(chk, r[0]);
  M(chk, chk, den);
  if (neq25519(chk, num)) M(r[0], r[0], I);

  S(chk, r[0]);
  M(chk, chk, den);
  if (neq25519(chk, num)) return -1;

  if (par25519(r[0]) == (p[31] >> 7)) Z(r[0], gf0, r[0]);

  M(r[3], r[0], r[1]);
  return 0;
}

static inline int verify_32(const uint8_t *x, const uint8_t *y) {
  uint32_t diff = 0;
  for (int i = 0; i < 32; i++) diff |= (x[i] ^ y[i]);
  return (int)((1 & ((diff - 1) >> 8)) - 1);
}

} // namespace dactyl_ota

class DactylOtaVerifier {
private:
  uint8_t h[64];
  uint8_t buf[128];
  size_t buf_len;
  uint64_t total_bytes;
  uint8_t sig[64];
  uint8_t pk[32];
  dactyl_ota::gf q[4];
  bool valid;
  size_t expected_size;
  size_t written_size;

  void update_sha(const uint8_t* data, size_t len) {
    total_bytes += len;
    while (len > 0) {
      if (buf_len == 0 && len >= 128) {
        size_t blocks = len / 128;
        dactyl_ota::hashblocks_sha512(h, data, blocks * 128);
        data += blocks * 128;
        len -= blocks * 128;
      } else {
        size_t to_copy = 128 - buf_len;
        if (to_copy > len) to_copy = len;
        memcpy(buf + buf_len, data, to_copy);
        buf_len += to_copy;
        data += to_copy;
        len -= to_copy;
        if (buf_len == 128) {
          dactyl_ota::hashblocks_sha512(h, buf, 128);
          buf_len = 0;
        }
      }
    }
  }

public:
  DactylOtaVerifier() : buf_len(0), total_bytes(0), valid(false), expected_size(0), written_size(0) {}

  bool init(const uint8_t pubkey[32], const uint8_t signature[64], size_t size) {
    valid = true;
    expected_size = size;
    written_size = 0;
    memcpy(sig, signature, 64);
    memcpy(pk, pubkey, 32);

    if (dactyl_ota::unpackneg(q, pk) != 0) {
      valid = false;
      return false;
    }

    for (int j = 0; j < 64; j++) h[j] = dactyl_ota::iv[j];
    buf_len = 0;
    total_bytes = 0;

    // R und A zuerst in den SHA-512-Stream einspeisen (RFC 8032: H(R || A || M))
    update_sha(sig, 32);
    update_sha(pk, 32);
    return true;
  }

  void update(const uint8_t* data, size_t len) {
    if (!valid || len == 0) return;
    update_sha(data, len);
    written_size += len;
  }

  bool verify() {
    if (!valid) return false;
    if (written_size != expected_size) return false;

    uint8_t hash_out[64];
    uint8_t x[256];
    uint64_t b = total_bytes;
    size_t n = buf_len;
    for (int j = 0; j < 256; j++) x[j] = 0;
    for (size_t j = 0; j < n; j++) x[j] = buf[j];
    x[n] = 128;

    n = 256 - 128 * (n < 112);
    x[n - 9] = (uint8_t)(b >> 61);
    dactyl_ota::ts64(x + n - 8, b << 3);
    dactyl_ota::hashblocks_sha512(h, x, n);

    for (int j = 0; j < 64; j++) hash_out[j] = h[j];

    dactyl_ota::gf p[4];
    uint8_t t[32];
    dactyl_ota::reduce(hash_out);
    dactyl_ota::scalarmult(p, q, hash_out);

    dactyl_ota::gf base_q[4];
    dactyl_ota::scalarbase(base_q, sig + 32);
    dactyl_ota::add(p, base_q);
    dactyl_ota::pack(t, p);

    return (dactyl_ota::verify_32(sig, t) == 0);
  }

  size_t getWritten() const { return written_size; }
  size_t getExpected() const { return expected_size; }
  bool isValid() const { return valid; }
};

inline bool dactyl_ota_verify(const uint8_t pubkey[32], const uint8_t signature[64], const uint8_t* data, size_t len) {
  DactylOtaVerifier v;
  if (!v.init(pubkey, signature, len)) return false;
  v.update(data, len);
  return v.verify();
}
