#!/usr/bin/env bash
# Despliegue local en Anvil:
#   1. Despliega Escrow
#   2. Despliega TokenA y TokenB (ERC20 de prueba con mint público)
#   3. Registra ambos tokens en el Escrow
#   4. Mintea 1000 tokens de cada tipo a las 3 cuentas de prueba de Anvil
#   5. Actualiza ESCROW_ADDRESS en web/lib/contracts.ts
#   6. Genera deployment-info.txt con las direcciones desplegadas
#
# Requisito previo: Anvil corriendo en http://localhost:8545
# Uso: ./deploy.sh

set -euo pipefail

RPC_URL="http://localhost:8545"
CHAIN_ID=31337
# Anvil account #0 (clave determinista por defecto)
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SC_DIR="$ROOT_DIR/sc"
WEB_DIR="$ROOT_DIR/web"
CONTRACTS_TS="$WEB_DIR/lib/contracts.ts"
ENV_LOCAL="$WEB_DIR/.env.local"
INFO_FILE="$ROOT_DIR/deployment-info.txt"

echo "==> Verificando que Anvil esté escuchando en $RPC_URL"
if ! cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "ERROR: no se pudo conectar a Anvil en $RPC_URL. ¿Está corriendo 'anvil'?" >&2
  exit 1
fi

echo "==> forge build"
( cd "$SC_DIR" && forge build )

echo "==> Desplegando contratos en Anvil"
DEPLOY_OUTPUT=$(
  cd "$SC_DIR" && forge script script/DeployLocal.s.sol:DeployLocal \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --broadcast
)
echo "$DEPLOY_OUTPUT"

extract_addr() {
  echo "$DEPLOY_OUTPUT" | grep -oE "$1=\s*0x[a-fA-F0-9]{40}" | tail -1 | grep -oE "0x[a-fA-F0-9]{40}"
}

ESCROW_ADDRESS=$(extract_addr "ESCROW_ADDRESS")
TOKEN_A_ADDRESS=$(extract_addr "TOKEN_A_ADDRESS")
TOKEN_B_ADDRESS=$(extract_addr "TOKEN_B_ADDRESS")
TOKEN_C_ADDRESS=$(extract_addr "TOKEN_C_ADDRESS")

if [[ -z "$ESCROW_ADDRESS" || -z "$TOKEN_A_ADDRESS" || -z "$TOKEN_B_ADDRESS" || -z "$TOKEN_C_ADDRESS" ]]; then
  echo "ERROR: no se pudieron extraer todas las direcciones del despliegue." >&2
  exit 1
fi

echo "==> Escrow:  $ESCROW_ADDRESS"
echo "==> TokenA:  $TOKEN_A_ADDRESS"
echo "==> TokenB:  $TOKEN_B_ADDRESS"
echo "==> TokenC:  $TOKEN_C_ADDRESS"

echo "==> Actualizando $CONTRACTS_TS"
if [[ ! -f "$CONTRACTS_TS" ]]; then
  echo "ERROR: no existe $CONTRACTS_TS" >&2
  exit 1
fi

# Sustituye la línea de ESCROW_ADDRESS por una dirección hardcodeada para el entorno local.
python - "$CONTRACTS_TS" "$ESCROW_ADDRESS" "$TOKEN_A_ADDRESS" "$TOKEN_B_ADDRESS" <<'PY'
import re, sys, pathlib
path = pathlib.Path(sys.argv[1])
escrow, tokenA, tokenB = sys.argv[2], sys.argv[3], sys.argv[4]
text = path.read_text(encoding="utf-8")

text = re.sub(
    r'export const ESCROW_ADDRESS\s*=.*?;',
    f'export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS ?? "{escrow}") as `0x${{string}}`;',
    text,
    count=1,
)

def upsert(name, value):
    global text
    line = f'export const {name} = (process.env.NEXT_PUBLIC_{name} ?? "{value}") as `0x${{string}}`;'
    pattern = rf'export const {name}\s*=.*?;'
    if re.search(pattern, text):
        text = re.sub(pattern, line, text, count=1)
    else:
        text = text.rstrip() + "\n" + line + "\n"

upsert("TOKEN_A_ADDRESS", tokenA)
upsert("TOKEN_B_ADDRESS", tokenB)

path.write_text(text, encoding="utf-8")
PY

echo "==> Actualizando $ENV_LOCAL"
python - "$ENV_LOCAL" "$ESCROW_ADDRESS" "$TOKEN_A_ADDRESS" "$TOKEN_B_ADDRESS" "$TOKEN_C_ADDRESS" "$CHAIN_ID" "$RPC_URL" <<'PY'
import pathlib, sys
path, escrow, tokenA, tokenB, tokenC, chain_id, rpc_url = (
    pathlib.Path(sys.argv[1]),
    *sys.argv[2:8],
)

values = {
    "NEXT_PUBLIC_ESCROW_ADDRESS": escrow,
    "NEXT_PUBLIC_TOKEN_A_ADDRESS": tokenA,
    "NEXT_PUBLIC_TOKEN_B_ADDRESS": tokenB,
    "NEXT_PUBLIC_TOKEN_C_ADDRESS": tokenC,
    "NEXT_PUBLIC_CHAIN_ID": chain_id,
    "NEXT_PUBLIC_RPC_URL": rpc_url,
}

lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
seen = set()
out = []
for line in lines:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
        out.append(line)
        continue
    key = stripped.split("=", 1)[0].strip()
    if key in values:
        out.append(f"{key}={values[key]}")
        seen.add(key)
    else:
        out.append(line)

for key, value in values.items():
    if key not in seen:
        out.append(f"{key}={value}")

path.write_text("\n".join(out) + "\n", encoding="utf-8")
PY

echo "==> Escribiendo $INFO_FILE"
cat > "$INFO_FILE" <<EOF
Despliegue local en Anvil ($RPC_URL)
Chain ID: $CHAIN_ID
Fecha:    $(date -Iseconds 2>/dev/null || date)

Escrow:   $ESCROW_ADDRESS
TokenA:   $TOKEN_A_ADDRESS
TokenB:   $TOKEN_B_ADDRESS

Cuentas con 1000 TKA y 1000 TKB minteados:
  0xf39Fd6e51AAd88F6F4cE6Ab8827279cFFFb92266
  0x70997970C51812dc3A010C7d01b50e0d17DC79c8
  0x3C44CdDdB6a900FA2b585dD299E03D12FA4293Bc
EOF

echo "==> Listo."
