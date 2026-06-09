#!/usr/bin/env bash
set -euo pipefail
OUT=${1:-./pki}
mkdir -p "$OUT"
openssl genrsa -out "$OUT/ca.key" 4096
openssl req -x509 -new -nodes -key "$OUT/ca.key" -sha384 -days 3650 -out "$OUT/ca.crt" -subj "/CN=ProxHQVPN Private CA/O=Alpha Unlimited Technologies LLC"
openssl genrsa -out "$OUT/daemon.key" 3072
openssl req -new -key "$OUT/daemon.key" -out "$OUT/daemon.csr" -subj "/CN=proxhq-daemon"
openssl x509 -req -in "$OUT/daemon.csr" -CA "$OUT/ca.crt" -CAkey "$OUT/ca.key" -CAcreateserial -out "$OUT/daemon.crt" -days 397 -sha384
chmod 600 "$OUT"/*.key
echo "mTLS CA and daemon certificate generated in $OUT. Store CA key in HSM/KMS-backed secret storage for production."
