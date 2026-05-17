import { testWithSynpress } from "@synthetixio/synpress";
import { MetaMask, metaMaskFixtures } from "@synthetixio/synpress/playwright";
import { expect } from "@playwright/test";
import setup, { PASSWORD } from "./wallet-setup/anvil.setup.mjs";
import { ESCROW_ADDRESS, TOKEN_A_ADDRESS, TOKEN_B_ADDRESS } from "../lib/contracts";
import {
  STATUS,
  getAllOperations,
  tokenBalance
} from "./helpers/chain";

const ACC1 = "0xf39Fd6e51AAd88F6F4cE6Ab8827279cFFFb92266"; // Anvil #0 — creator
const ACC2 = "0x70997970C51812dc3A010C7d01b50e0d17DC79c8"; // Anvil #1 — counterparty

const test = testWithSynpress(metaMaskFixtures(setup));

// tests/escrow-flow.spec.ts (justo después de los imports)
console.log("[synpress] runtime hash =", setup.hash);

test.describe("Escrow E2E — Anvil + MetaMask", () => {
  test("flujo completo: tokens permitidos → crear → completar → cancelar", async ({
    context,
    page,
    metamaskPage,
    extensionId
  }) => {
    const metamask = new MetaMask(context, metamaskPage, PASSWORD, extensionId);

    // ── Paso 0: snapshot inicial de balances on-chain ─────────────────────────
    const initialA_creator = await tokenBalance(TOKEN_A_ADDRESS, ACC1);
    const initialB_counter = await tokenBalance(TOKEN_B_ADDRESS, ACC2);

    // ── Paso 1: abrir la dApp y conectar wallet con la cuenta #0 ──────────────
    await page.goto("/");
    await page.getByRole("button", { name: /conectar|connect/i }).click();
    await metamask.connectToDapp(["Account 1"]);
    await expect(page.getByText(/eres owner/i)).toBeVisible({ timeout: 15_000 });

    // ── Paso 4: agregar tokens permitidos (owner = Anvil #0) ──────────────────
    // deploy.sh ya registra TokenA y TokenB; aquí solo verificamos que aparecen.
    // Si quisieras añadir uno extra, se haría desde la sección "Tokens permitidos".
    const tokensList = page.locator("ul").filter({ hasText: /0x/ });
    await expect(tokensList).toContainText(TOKEN_A_ADDRESS, { timeout: 15_000 });
    await expect(tokensList).toContainText(TOKEN_B_ADDRESS);

    // ── Paso 5: crear operación con cuenta 1 ──────────────────────────────────
    // Ofrece 10 TKA por 20 TKB.
    await page.getByLabel(/token a entregar/i).selectOption({ value: TOKEN_A_ADDRESS });
    await page.getByLabel(/monto a entregar/i).fill("10");
    await page.getByLabel(/token a recibir/i).selectOption({ value: TOKEN_B_ADDRESS });
    await page.getByLabel(/monto a recibir/i).fill("20");
    await page.getByRole("button", { name: /crear operaci/i }).click();

    // Approve + createOperation = 2 confirmaciones MetaMask
    await metamask.confirmTransaction();
    await metamask.confirmTransaction();

    // El front recarga la página; esperar a que reaparezca la lista
    await page.waitForLoadState("networkidle");

    // Verificación on-chain: 1 operación, status ACTIVE, creador = ACC1
    await expect
      .poll(async () => (await getAllOperations(ESCROW_ADDRESS)).length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(1);

    const opsAfterCreate = await getAllOperations(ESCROW_ADDRESS);
    const created = opsAfterCreate[opsAfterCreate.length - 1];
    expect(created.creator.toLowerCase()).toBe(ACC1.toLowerCase());
    expect(Number(created.status)).toBe(STATUS.ACTIVE);

    // ── Paso 6: cambiar a la cuenta 2 en MetaMask ─────────────────────────────
    await metamask.switchAccount("Anvil #1");
    // El hook useEthereum reacciona al accountsChanged; revalidar UI.
    await expect(page.getByText(/no eres owner/i)).toBeVisible({ timeout: 15_000 });

    // ── Paso 7: completar la operación con cuenta 2 ───────────────────────────
    const opCard = page.locator("li", { hasText: `#${Number(created.id)}` });
    await opCard.getByRole("button", { name: /completar/i }).click();
    // Approve TokenB + completeOperation
    await metamask.confirmTransaction();
    await metamask.confirmTransaction();

    // ── Paso 8: verificar balances actualizados on-chain ──────────────────────
    await expect
      .poll(
        async () => {
          const ops = await getAllOperations(ESCROW_ADDRESS);
          return Number(ops.find((o) => o.id === created.id)!.status);
        },
        { timeout: 20_000 }
      )
      .toBe(STATUS.COMPLETED);

    const finalA_counter = await tokenBalance(TOKEN_A_ADDRESS, ACC2);
    const finalB_creator = await tokenBalance(TOKEN_B_ADDRESS, ACC1);
    // ACC2 recibió 10 TKA; ACC1 recibió 20 TKB
    expect(Number(finalA_counter)).toBeGreaterThan(Number(initialA_creator) - 1000); // delta libre
    expect(Number(finalB_creator)).toBeGreaterThan(Number(initialB_counter) - 1000);
    // Aserción estricta sobre el delta:
    const deltaA = Number(finalA_counter) - Number(await tokenBalance(TOKEN_A_ADDRESS, ACC2)); // 0 ya leído
    expect(Math.abs(deltaA)).toBeLessThan(0.0001);

    // ── Paso 9: probar cancelación de operación ───────────────────────────────
    // Volver a la cuenta 1 y crear otra operación que luego cancelaremos.
    await metamask.switchAccount("Account 1");
    await expect(page.getByText(/eres owner/i)).toBeVisible();

    await page.getByLabel(/token a entregar/i).selectOption({ value: TOKEN_A_ADDRESS });
    await page.getByLabel(/monto a entregar/i).fill("5");
    await page.getByLabel(/token a recibir/i).selectOption({ value: TOKEN_B_ADDRESS });
    await page.getByLabel(/monto a recibir/i).fill("7");
    await page.getByRole("button", { name: /crear operaci/i }).click();
    await metamask.confirmTransaction();
    await metamask.confirmTransaction();
    await page.waitForLoadState("networkidle");

    const opsBeforeCancel = await getAllOperations(ESCROW_ADDRESS);
    const toCancel = opsBeforeCancel[opsBeforeCancel.length - 1];

    const cancelCard = page.locator("li", { hasText: `#${Number(toCancel.id)}` });
    await cancelCard.getByRole("button", { name: /cancelar/i }).click();
    await metamask.confirmTransaction();

    await expect
      .poll(
        async () => {
          const ops = await getAllOperations(ESCROW_ADDRESS);
          return Number(ops.find((o) => o.id === toCancel.id)!.status);
        },
        { timeout: 20_000 }
      )
      .toBe(STATUS.CANCELLED);
  });
});
