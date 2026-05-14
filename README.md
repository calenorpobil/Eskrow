# Eskrow — DApp de Escrow para intercambio de tokens ERC20

DApp que permite a dos partes intercambiar tokens ERC20 de forma confiable mediante un contrato de escrow. Soporta crear operaciones de swap, completarlas y cancelarlas.

## Estructura

```
Eskrow/
├── sc/                          # Smart Contracts (Foundry)
│   ├── src/
│   │   └── Escrow.sol           # Contrato principal
│   ├── script/
│   │   └── Deploy.s.sol         # Script de deployment
│   └── test/
│       └── Escrow.t.sol         # Tests del contrato
│
├── web/                         # Frontend (Next.js 14 + ethers.js v6)
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx             # Página principal
│   ├── components/
│   │   ├── ConnectButton.tsx    # Conectar wallet
│   │   ├── AddToken.tsx         # Agregar tokens permitidos
│   │   ├── CreateOperation.tsx  # Crear operación de swap
│   │   ├── OperationsList.tsx   # Lista de operaciones
│   │   └── BalanceDebug.tsx     # Debug de balances
│   └── lib/
│       ├── ethereum.tsx         # Context provider de Ethereum
│       └── contracts.ts         # ABIs y direcciones
│
├── deploy.sh                    # Script de deployment automático
└── README.md
```

## Flujo funcional

1. **Crear swap**: el iniciador aprueba el token A y llama `createSwap(counterparty, tokenA, amountA, tokenB, amountB)`.
2. **Completar swap**: la contraparte aprueba el token B y llama `completeSwap(id)`; el contrato libera ambos tokens.
3. **Cancelar swap**: el iniciador puede llamar `cancelSwap(id)` mientras siga `Active` y recupera su depósito.

## Smart contracts

```bash
cd sc
forge build
forge test
```

## Frontend

```bash
cd web
npm install
cp .env.local.example .env.local   # ajusta NEXT_PUBLIC_ESCROW_ADDRESS / RPC
npm run dev
```

## Despliegue

```bash
# Configura sc/.env con PRIVATE_KEY, SEPOLIA_RPC_URL y (opcional) ETHERSCAN_API_KEY
./deploy.sh sepolia   # o ./deploy.sh anvil para local
```

El script escribe la dirección desplegada en `web/.env.local` para que el frontend la consuma directamente.
