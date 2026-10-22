"""Remove transient sync files from a prepared deployment archive."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import tarfile
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
if args.source.resolve() == args.output.resolve():
    raise SystemExit("Use a different output path to preserve the original archive.")

removed = []
files = 0
limit = 25 * 1024 * 1024
with tarfile.open(args.source, "r:*") as source:
    members = source.getmembers()
    by_name = {member.name: member for member in members}
    retained = []
    for member in members:
        if ".rsync-tmp" in Path(member.name).parts:
            removed.append(member.name)
            continue
        name = Path(member.name).name
        # ONNX WASM is a browser asset; its SSR copy is not a server module.
        if member.name.startswith("dist/server/ssr/assets/") and name.startswith("ort-wasm-") and name.endswith((".wasm", ".wasm.gz")):
            removed.append(member.name)
            continue
        if member.isfile() and member.size > limit:
            encoded = by_name.get(member.name + ".gz")
            if not member.name.startswith("dist/client/") or not name.endswith(".wasm") or not encoded or encoded.size > limit:
                raise SystemExit(f"Release file exceeds the hosting limit: {member.name}")
            original_hash = hashlib.sha256(source.extractfile(member).read()).digest()
            decoded_hash = hashlib.sha256(gzip.decompress(source.extractfile(encoded).read())).digest()
            if original_hash != decoded_hash:
                raise SystemExit(f"Compressed runtime does not match its original: {member.name}")
            removed.append(member.name)
            continue
        retained.append(member)
    # Validate before writing, and publish only a complete output archive.
    with tempfile.TemporaryDirectory(prefix="fama-release-", dir=args.output.parent) as temporary:
        staged = Path(temporary) / "release.tar"
        with tarfile.open(staged, "w", format=tarfile.PAX_FORMAT) as output:
            for member in retained:
                output.addfile(member, source.extractfile(member) if member.isfile() else None)
                files += int(member.isfile())
        with tarfile.open(staged, "r:") as archive:
            for member in archive:
                if ".rsync-tmp" in Path(member.name).parts or (member.isfile() and member.size > limit):
                    raise SystemExit("The output archive did not pass release validation.")
        staged.replace(args.output)

print(json.dumps({"archive": str(args.output.resolve()), "files": files, "removed_temporary_entries": len(removed)}))
