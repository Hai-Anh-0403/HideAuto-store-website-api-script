"""Generate the Ed25519 pair that signs mini-app licences.

    uv run python scripts/gen_license_key.py

Put the seed in `LICENSE_SIGNING_KEY`. The public key is printed for reference only —
the store bakes it into every package on its own, so it never needs configuring.

Rotating the seed invalidates every licence already handed out: packages downloaded
before the change carry the old public key and will reject new licences, so buyers must
re-download. Rotate only after a leak.
"""

import base64

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


def main() -> None:
    private_key = Ed25519PrivateKey.generate()
    seed = base64.b64encode(private_key.private_bytes_raw()).decode("ascii")
    public = base64.b64encode(private_key.public_key().public_bytes_raw()).decode("ascii")
    print(f"LICENSE_SIGNING_KEY={seed}")
    print(f"# public key (baked into packages): {public}")


if __name__ == "__main__":
    main()
