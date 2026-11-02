#!/usr/bin/env python3
"""Check the association files that tnc serves (DESIGN.md 6.5).

Usage: check_well_known.py [REPO_DIR] [--artifact ARTIFACT_TAR]

Fails when a file is not valid JSON, still holds a placeholder fingerprint,
mentions webcredentials or get_login_creds, or when the two Apple copies
differ. With --artifact it also checks that .well-known/ is in the Pages
artifact.
"""
import json
import re
import sys
import tarfile
from pathlib import Path

AASA = [".well-known/apple-app-site-association", "apple-app-site-association"]
ASSETLINKS = ".well-known/assetlinks.json"
FINGERPRINT = re.compile(r"^([0-9A-F]{2}:){31}[0-9A-F]{2}$")
FORBIDDEN = ("webcredentials", "get_login_creds")
ANDROID_PACKAGES = {"com.psychelinx.android", "com.psychelinx.android.debug"}


def check(root: Path) -> list:
    errors = []
    texts = {}
    for rel in AASA + [ASSETLINKS]:
        path = root / rel
        if not path.is_file():
            errors.append(f"{rel}: missing")
            continue
        text = path.read_text(encoding="utf-8")
        texts[rel] = text
        try:
            json.loads(text)
        except ValueError as exc:
            errors.append(f"{rel}: invalid JSON ({exc})")
        for word in FORBIDDEN:
            if word in text:
                errors.append(f"{rel}: contains forbidden {word}")
        if re.search(r"<[A-Z0-9_]+>", text):
            errors.append(f"{rel}: contains a placeholder value")
    if len(texts) == len(AASA) + 1 and texts[AASA[0]] != texts[AASA[1]]:
        errors.append("apple-app-site-association copies differ")
    if ASSETLINKS in texts and not errors:
        for entry in json.loads(texts[ASSETLINKS]):
            if entry.get("relation") != ["delegate_permission/common.handle_all_urls"]:
                errors.append(f"{ASSETLINKS}: only handle_all_urls is allowed")
            target = entry.get("target", {})
            if target.get("package_name") not in ANDROID_PACKAGES:
                errors.append(f"{ASSETLINKS}: unexpected package {target.get('package_name')}")
            prints = target.get("sha256_cert_fingerprints", [])
            if not prints or not all(FINGERPRINT.match(p) for p in prints):
                errors.append(f"{ASSETLINKS}: bad fingerprint format")
    if AASA[0] in texts and not errors:
        if "applinks" not in json.loads(texts[AASA[0]]):
            errors.append("apple-app-site-association: applinks missing")
    return errors


def check_artifact(tar_path: Path) -> list:
    with tarfile.open(tar_path) as tar:
        names = [n[2:] if n.startswith("./") else n for n in tar.getnames()]
    errors = []
    for rel in (ASSETLINKS, AASA[0], AASA[1], "404.html", ".nojekyll"):
        if rel not in names:
            errors.append(f"artifact: {rel} missing")
    return errors


def main(argv: list) -> int:
    args = argv[1:]
    artifact = None
    if "--artifact" in args:
        i = args.index("--artifact")
        artifact = Path(args[i + 1])
        del args[i:i + 2]
    root = Path(args[0]) if args else Path(__file__).resolve().parent.parent
    errors = check(root)
    if artifact:
        errors += check_artifact(artifact)
    for e in errors:
        print(f"ERROR {e}")
    if not errors:
        print("well-known files OK")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
