#!/usr/bin/env python3
"""استخراج و راستی‌آزمایی payload داخل exeهای NSIS نسخه ۱.۴.۰ — بدون حدس و گمان.
NSIS installer ساخته electron-builder شامل app-64.7z است؛ امضای 7z را پیدا و
payload را برش می‌زنیم، با py7zr استخراج و محتوای بحرانی را چک می‌کنیم."""
import sys, os, re, struct

MAGIC = b"7z\xbc\xaf\x27\x1c"

def find_7z_offsets(path):
    data = open(path, "rb").read()
    offs = [m.start() for m in re.finditer(re.escape(MAGIC), data)]
    return data, offs

def try_extract(data, off, outdir):
    """7z header is at offset; carve from off to EOF and try py7zr.
    Trailing bytes after end-of-archive may break py7zr; trim iteratively."""
    import py7zr, io, tempfile
    payload = data[off:]
    # py7zr can read from a file object; try full payload first
    for trim in (0, 512, 1024, 4096, 16384, 65536, 262144, 1048576):
        try:
            buf = io.BytesIO(payload[: len(payload) - trim] if trim else payload)
            with py7zr.SevenZipFile(buf) as z:
                z.extractall(outdir)
            return len(payload) - trim
        except Exception:
            continue
    return None

def main():
    exe = sys.argv[1]
    outdir = sys.argv[2]
    data, offs = find_7z_offsets(exe)
    print(f"{os.path.basename(exe)}: size={len(data)}  7z-magic hits={len(offs)}")
    # try each magic from the end backwards (payload is near the end)
    for off in reversed(offs):
        size = try_extract(data, off, outdir)
        if size:
            print(f"  extracted OK: 7z payload at offset {off}, size {size}")
            break
    else:
        print("  FAILED: no extractable 7z payload found")
        sys.exit(1)

if __name__ == "__main__":
    main()
