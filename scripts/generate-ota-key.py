#!/usr/bin/env python3
"""
Erzeugt das Ed25519-Signaturschlüsselpaar für OTA-Updates:
- Privater Schlüssel: .ota_signing_key.pem (Modus 0600, in .gitignore)
- Öffentlicher Schlüssel: firmware/dactyl_right/DactylOtaKey.h (Modus 0600, in .gitignore)

Aufruf: python3 scripts/generate-ota-key.py [--force | --if-missing]
"""

import sys
import os
import stat
import re

REPO_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRIV_KEY_FILE = os.environ.get("DACTYL_OTA_PRIV_KEY_FILE", os.path.join(REPO_DIR, ".ota_signing_key.pem"))
PUB_HEADER_FILE = os.environ.get("DACTYL_OTA_KEY_FILE", os.path.join(REPO_DIR, "firmware", "dactyl_right", "DactylOtaKey.h"))

def generate_keypair():
    try:
        from cryptography.hazmat.primitives.asymmetric import ed25519
        from cryptography.hazmat.primitives import serialization
        priv = ed25519.Ed25519PrivateKey.generate()
        priv_pem = priv.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        pub = priv.public_key()
        pub_raw = pub.public_bytes_raw()
        return priv_pem, pub_raw
    except ImportError:
        # Reiner Python-Fallback ohne externe Abhängigkeiten
        import hashlib
        import secrets
        seed = secrets.token_bytes(32)
        # RFC 8032 public key generation
        h = hashlib.sha512(seed).digest()
        a = bytearray(h[:32])
        a[0] &= 248
        a[31] &= 127
        a[31] |= 64
        s = int.from_bytes(a, "little")
        # Basepoint B on Ed25519
        p = 2**255 - 19
        d = -121665 * pow(121666, p - 2, p) % p
        def xrecover(y):
            xx = (y * y - 1) * pow(d * y * y + 1, p - 2, p) % p
            x = pow(xx, (p + 3) // 8, p)
            if (x * x - xx) % p != 0:
                x = (x * pow(2, (p - 1) // 4, p)) % p
            if x % 2 != 0:
                x = p - x
            return x
        By = 4 * pow(5, p - 2, p) % p
        Bx = xrecover(By)
        # Point addition and scalar multiplication
        def edwards_add(P, Q):
            x1, y1 = P
            x2, y2 = Q
            x3 = (x1 * y2 + y1 * x2) * pow(1 + d * x1 * x2 * y1 * y2, p - 2, p) % p
            y3 = (y1 * y2 + x1 * x2) * pow(1 - d * x1 * x2 * y1 * y2, p - 2, p) % p
            return (x3, y3)
        def scalarmult(P, e):
            Q = (0, 1)
            while e > 0:
                if e & 1:
                    Q = edwards_add(Q, P)
                P = edwards_add(P, P)
                e >>= 1
            return Q
        A = scalarmult((Bx, By), s)
        Ax, Ay = A
        pub_bytes = bytearray(Ay.to_bytes(32, "little"))
        if Ax & 1:
            pub_bytes[31] |= 0x80
        # Minimal PKCS#8 ASN.1 wrapping for Ed25519:
        # SEQUENCE (48) { INTEGER 0, SEQUENCE { OID 1.3.101.112 }, OCTET STRING { OCTET STRING (32 bytes seed) } }
        import base64
        asn1 = b"\x30\x2e\x02\x01\x00\x30\x05\x06\x03\x2b\x65\x70\x04\x22\x04\x20" + seed
        b64 = base64.b64encode(asn1).decode("ascii")
        lines = [b64[i:i+64] for i in range(0, len(b64), 64)]
        priv_pem = ("-----BEGIN PRIVATE KEY-----\n" + "\n".join(lines) + "\n-----END PRIVATE KEY-----\n").encode("utf-8")
        return priv_pem, bytes(pub_bytes)

def pub_header_is_valid(path):
    if not os.path.exists(path):
        return False
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        if "#define DACTYL_OTA_KEY_PRESENT 1" not in content:
            return False
        matches = re.findall(r"0x[0-9a-fA-F]{2}", content)
        return len(matches) == 32
    except Exception:
        return False

def priv_pem_is_valid(path):
    if not os.path.exists(path):
        return False
    try:
        with open(path, "rb") as f:
            data = f.read()
        return b"-----BEGIN PRIVATE KEY-----" in data and b"-----END PRIVATE KEY-----" in data
    except Exception:
        return False

def main():
    args = sys.argv[1:]
    mode = args[0] if args else ""
    if len(args) > 1 or (mode and mode not in ("--force", "--if-missing")):
        sys.stderr.write("Aufruf: python3 scripts/generate-ota-key.py [--force | --if-missing]\n")
        sys.exit(2)

    has_priv = os.path.exists(PRIV_KEY_FILE)
    has_pub = os.path.exists(PUB_HEADER_FILE)

    if (has_priv or has_pub) and mode == "--if-missing":
        if not (priv_pem_is_valid(PRIV_KEY_FILE) and pub_header_is_valid(PUB_HEADER_FILE)):
            sys.stderr.write(f"OTA-Schlüsseldatei ist beschädigt (neu erzeugen mit --force): {PRIV_KEY_FILE}\n")
            sys.exit(1)
        try:
            os.chmod(PRIV_KEY_FILE, 0o600)
            os.chmod(PUB_HEADER_FILE, 0o600)
        except OSError:
            pass
        sys.exit(0)

    if (has_priv or has_pub) and mode != "--force":
        sys.stderr.write(f"OTA-Schlüssel existiert bereits: {PRIV_KEY_FILE} (neu erzeugen mit --force)\n")
        sys.exit(1)

    priv_pem, pub_raw = generate_keypair()

    # Schreibe Private Key atomar mit Modus 0600
    os.umask(0o077)
    tmp_priv = PRIV_KEY_FILE + f".tmp.{os.getpid()}"
    with open(tmp_priv, "wb") as f:
        f.write(priv_pem)
    os.chmod(tmp_priv, 0o600)
    os.replace(tmp_priv, PRIV_KEY_FILE)

    # Schreibe Public Key C-Header atomar mit Modus 0600
    bytes_str = ", ".join(f"0x{b:02x}" for b in pub_raw)
    tmp_pub = PUB_HEADER_FILE + f".tmp.{os.getpid()}"
    with open(tmp_pub, "w", encoding="utf-8") as f:
        f.write("#pragma once\n")
        f.write("// Erzeugt von scripts/generate-ota-key.py. Geheim: nicht committen, nicht weitergeben.\n")
        f.write("#include <stdint.h>\n")
        f.write("#define DACTYL_OTA_KEY_PRESENT 1\n")
        f.write(f"static const uint8_t DACTYL_OTA_PUBLIC_KEY[32] = {{{bytes_str}}};\n")
    os.chmod(tmp_pub, 0o600)
    os.replace(tmp_pub, PUB_HEADER_FILE)

    print(f"OTA-Signaturschlüssel erzeugt: {PRIV_KEY_FILE} und {PUB_HEADER_FILE} (Modus 0600).")

if __name__ == "__main__":
    main()
