"""Writes disposable PNG image sequences for native Object Mask tests (standard library only).

subject_seq: a light disc (the "subject") moves left to right over a dark gradient, so Premiere's Object Mask has
something clear to select and track.
two_subject_seq: the same disc plus a teal square moving right to left in the upper half, so one clip can carry two
separate object masks.
Output: _qa_scratch/fixtures/<name>/<prefix>_0001.png ... (git-ignored).
Usage: python scripts/make_fixtures.py [frames] [one|two|both]
"""
import os
import struct
import sys
import zlib

W, H = 640, 360


def png_bytes(rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))


def frame(k, frames, two=False):
    t = k / max(1, frames - 1)
    cx = 120 + (W - 240) * t
    cy = H * 0.62 if two else H * 0.55
    r = 60 if two else 70
    sx = (W - 150) - (W - 300) * t  # square centre, moving the other way
    sy = H * 0.27
    half = 45
    rows = []
    for y in range(H):
        row = bytearray()
        for x in range(W):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= r * r:
                shade = 235 - int(40 * (dy + r) / (2 * r))
                row += bytes((shade, shade - 20, 120))
            elif two and abs(x - sx) <= half and abs(y - sy) <= half:
                row += bytes((40, 200, 190))
            else:
                g = 30 + int(40 * y / H)
                row += bytes((g // 2, g // 2, g))
        rows.append(row)
    return png_bytes(rows)


def write(name, prefix, frames, two):
    root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "_qa_scratch", "fixtures", name)
    os.makedirs(root, exist_ok=True)
    for k in range(frames):
        with open(os.path.join(root, "%s_%04d.png" % (prefix, k + 1)), "wb") as f:
            f.write(frame(k, frames, two))
    print("wrote %d frames to %s" % (frames, root))


def main():
    frames = int(sys.argv[1]) if len(sys.argv) > 1 else 48
    which = sys.argv[2] if len(sys.argv) > 2 else "one"
    if which in ("one", "both"):
        write("subject_seq", "subject", frames, False)
    if which in ("two", "both"):
        write("two_subject_seq", "twosub", frames, True)


if __name__ == "__main__":
    main()
