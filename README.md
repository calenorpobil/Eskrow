# Escrow DApp

dApp de escrow para intercambio P2P de tokens ERC20. Una cuenta crea una
operación ofreciendo `amountA` de `tokenA` a cambio de `amountB` de `tokenB`;
cualquier otra cuenta puede aceptarla pagando el `tokenB` solicitado. El
contrato custodia los tokens entre `createOperation` y `completeOperation`.

## Estructura del repo

```
.
├── sc/             # Contratos Solidity (Foundry)
│   ├── src/
│   │   ├── Escrow.sol         # Contrato principal
│   │   └── TestToken.sol      # ERC20 con mint público (solo dev)
│   └── script/
│       ├── DeployLocal.s.sol  # Deploy a Anvil + tokens + allowlist
│       └── Deploy.s.sol       # Deploy a redes reales
├── web/            # Frontend Next.js (App Router) + ethers v6
│   ├── app/
│   ├── components/            # AddToken, CreateOperation, OperationsList, AnvilBalances
│   ├── lib/                   # contracts, ethereum, accounts, airdrop, errors
│   └── tests/                 # E2E Playwright + Synpress (ver web/tests/README.md)
├── deploy.sh                  # Build + deploy local + sync de web/.env.local
└── README.md
```

## Componentes principales

### Contrato `Escrow` ([sc/src/Escrow.sol](sc/src/Escrow.sol))

- **Owner-gated allowlist** de tokens (`addToken` / `isTokenAllowed` /
  `getAllowedTokens`).
- `createOperation(tokenA, tokenB, amountA, amountB)` — el creador hace
  `approve` previo del `tokenA` por `amountA`; el contrato hace `transferFrom`
  y custodia los fondos. Devuelve `operationId`.
- `completeOperation(operationId)` — la contraparte hace `approve` previo del
  `tokenB`; el contrato mueve `tokenA` al taker y `tokenB` al creador
  atómicamente. No se puede completar la propia operación.
- `cancelOperation(operationId)` — solo el creador, mientras la op está
  `Active`. Devuelve el `tokenA` custodiado.
- Estado: `Active (0) | Completed (1) | Cancelled (2)`.

### Frontend (`web/`)

- **AddToken** — sección de tokens permitidos. Si la cuenta conectada es owner,
  permite agregar nuevos ERC20 a la allowlist + minteo a las cuentas activas.
  Muestra símbolo y nombre de cada token.
- **CreateOperation** — selector de tokens (lista on-chain), monto en unidades
  legibles (convertidas a wei con `decimals()`). Ejecuta `approve` +
  `createOperation` en dos transacciones.
- **OperationsList** — lista todas las operaciones con badges de estado.
  Botones contextuales: "Completar" (si no eres el creador y está activa),
  "Cancelar" (si eres el creador y está activa). Refresca cada 5s.
- **AnvilBalances** — panel lateral con balances de ETH y de cada token
  permitido para las cuentas activas. Resalta el contrato Escrow.
- **lib/errors.ts** — `parseTxError` / `parseReadError` para mensajes
  amigables (rechazo en MetaMask, allowance insuficiente, red caída, etc.).

## Setup local (Windows / PowerShell)

Necesitas: [Foundry](https://book.getfoundry.sh/getting-started/installation),
Node 20+, Python 3 (para el script de patcheo de `deploy.sh`) y bash
(`git bash` funciona).

```powershell
# Terminal 1 — Anvil (chain id 31337, 10 cuentas con 10000 ETH cada una)
anvil

# Terminal 2 — Build + deploy + sync de direcciones a web/.env.local
bash ./deploy.sh

# Terminal 3 — Frontend
cd web
npm install
npm run dev
```

`deploy.sh` despliega `Escrow`, `TokenA`, `TokenB`, los registra en la
allowlist, mintea 1000 de cada token a las 3 primeras cuentas de Anvil y
escribe las direcciones en `web/.env.local` y `deployment-info.txt`.

Abrir `http://localhost:3000`, conectar MetaMask a la red Anvil
(`http://localhost:8545`, chain id `31337`) e importar la cuenta #0 del seed
determinista de Anvil
(`test test test test test test test test test test test junk`) para tener
rol de owner.

## Flujo típico

1. Conectar wallet (cuenta #0 → owner).
2. (Opcional) Añadir más tokens en "Tokens permitidos".
3. "Crear operación de swap": elegir tokens A/B y montos → confirmar approve +
   createOperation en MetaMask.
4. Cambiar a otra cuenta de MetaMask.
5. En la lista, pulsar "Completar" sobre la operación abierta → confirmar
   approve B + completeOperation.
6. Verificar balances actualizados en el panel "Cuentas activas".

## Tests

### Smart contracts (Foundry)

```bash
cd sc
forge build
forge test
```

### E2E del frontend (Playwright + Synpress)

Cubre el flujo completo (allowlist, creación, completar con otra cuenta,
cancelación) contra Anvil con MetaMask real automatizado. Documentación,
prerrequisitos y comandos en [web/tests/README.md](web/tests/README.md).

```powershell
cd web
npm install
npm run test:e2e:setup   # primera vez: cachea MetaMask
npm run test:e2e:headed
```

## Variables de entorno (`web/.env.local`)

Las escribe `deploy.sh` automáticamente. Si quisieras editarlas a mano:

```
NEXT_PUBLIC_ESCROW_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_A_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_B_ADDRESS=0x...
NEXT_PUBLIC_TOKEN_C_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://localhost:8545
```
