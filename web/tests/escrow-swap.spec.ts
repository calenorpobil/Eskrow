import { testWithSynpress } from "@synthetixio/synpress";
import { MetaMask, metaMaskFixtures } from "@synthetixio/synpress/playwright";
import { expect } from "@playwright/test";
import setup, { PASSWORD } from "./wallet-setup/anvil.setup";
import {
  ESCROW_ADDRESS,
  TOKEN_A_ADDRESS,
  TOKEN_B_ADDRESS
} from "../lib/contracts";
import { STATUS, getAllOperations, tokenBalance } from "./helpers/chain";

const ACC1 = "0xf39Fd6e51AAd88F6F4cE6Ab8827279cFFFb92266"; // Anvil #0 — creador
const ACC2 = "0x70997970C51812dc3A010C7d01b50e0d17DC79c8"; // Anvil #1 — contraparte

const AMOUNT_A = "10"; // TKA ofrecidos
const AMOUNT_B = "20"; // TKB solicitados

const test = testWithSynpress(metaMaskFixtures(setup));

test.describe("Escrow E2E — flujo swap + cancelación", () => {
  test("crear con cuenta 1 → completar con cuenta 2 → verificar balances → cancelar", async ({
    context,
    page,
    metamaskPage,
    extensionId
  }) => {
    const metamask = new MetaMask(context, metamaskPage, PASSWORD, extensionId);

    // Snapshot inicial de balances on-chain (en unidades formateadas)
    const initA_acc1 = Number(await tokenBalance(TOKEN_A_ADDRESS, ACC1));
    const initB_acc1 = Number(await tokenBalance(TOKEN_B_ADDRESS, ACC1));
    const initA_acc2 = Number(await tokenBalance(TOKEN_A_ADDRESS, ACC2));
    const initB_acc2 = Number(await tokenBalance(TOKEN_B_ADDRESS, ACC2));

    // Conectar dApp con cuenta 1
    await page.goto("/");
    await page.getByRole("button", { name: /conectar|connect/i }).click();
    await metamask.connectToDapp(["Account 1"]);
    await expect(page.getByText(/eres owner/i)).toBeVisible({ timeout: 15_000 });

    // ── Paso 1: crear operación con cuenta 1 ─────────────────────────────────
    await page
      .getByLabel(/token a entregar/i)
      .selectOption({ value: TOKEN_A_ADDRESS });
    await page.getByLabel(/monto a entregar/i).fill(AMOUNT_A);
    await page
      .getByLabel(/token a recibir/i)
      .selectOption({ value: TOKEN_B_ADDRESS });
    await page.getByLabel(/monto a recibir/i).fill(AMOUNT_B);
    await page.getByRole("button", { name: /crear operaci/i }).click();

    // approve + createOperation
    await metamask.confirmTransaction();
    await metamask.confirmTransaction();
    await page.waitForLoadState("networkidle");

    await expect
      .poll(async () => (await getAllOperations(ESCROW_ADDRESS)).length, {
        timeout: 15_000
      })
      .toBeGreaterThanOrEqual(1);

    const opsAfterCreate = await getAllOperations(ESCROW_ADDRESS);
    const created = opsAfterCreate[opsAfterCreate.length - 1];
    expect(created.creator.toLowerCase()).toBe(ACC1.toLowerCase());
    expect(Number(created.status)).toBe(STATUS.ACTIVE);

    // ── Paso 2: cambiar a cuenta 2 en MetaMask ───────────────────────────────
    await metamask.switchAccount("Anvil #1");
    await expect(page.getByText(/no eres owner/i)).toBeVisible({
      timeout: 15_000
    });

    // ── Paso 3: completar operación con cuenta 2 ─────────────────────────────
    const opCard = page.locator("li", { hasText: `#${Number(created.id)}` });
    await opCard.getByRole("button", { name: /completar/i }).click();
    // approve TokenB + completeOperation
    await metamask.confirmTransaction();
    await metamask.confirmTransaction();

    await expect
      .poll(
        async () => {
          const ops = await getAllOperations(ESCROW_ADDRESS);
          return Number(ops.find((o) => o.id === created.id)!.status);
        },
        { timeout: 20_000 }
      )
      .toBe(STATUS.COMPLETED);

    // ── Paso 4: verificar balances actualizados ──────────────────────────────
    const finA_acc1 = Number(await tokenBalance(TOKEN_A_ADDRESS, ACC1));
    const finB_acc1 = Number(await tokenBalance(TOKEN_B_ADDRESS, ACC1));
    const finA_acc2 = Number(await tokenBalance(TOKEN_A_ADDRESS, ACC2));
    const finB_acc2 = Number(await tokenBalance(TOKEN_B_ADDRESS, ACC2));

    const a = Number(AMOUNT_A);
    const b = Number(AMOUNT_B);
    const EPS = 1e-9;

    // ACC1 entregó 10 TKA y recibió 20 TKB
    expect(finA_acc1).toBeCloseTo(initA_acc1 - a, 6);
    expect(finB_acc1).toBeCloseTo(initB_acc1 + b, 6);
    // ACC2 recibió 10 TKA y entregó 20 TKB
    expect(finA_acc2).toBeCloseTo(initA_acc2 + a, 6);
    expect(finB_acc2).toBeCloseTo(initB_acc2 - b, 6);
    expect(Math.abs(finA_acc1 - (initA_acc1 - a))).toBeLessThan(EPS);

    // ── Paso 5: probar cancelación de operación ──────────────────────────────
    // Volver a cuenta 1, crear nueva operación y cancelarla.
    await metamask.switchAccount("Account 1");
    await expect(page.getByText(/eres owner/i)).toBeVisible();

    const beforeCancelA = Number(await tokenBalance(TOKEN_A_ADDRESS, ACC1));

    await page
      .getByLabel(/token a entregar/i)
      .selectOption({ value: TOKEN_A_ADDRESS });
    await page.getByLabel(/monto a entregar/i).fill("5");
    await page
      .getByLabel(/token a recibir/i)
      .selectOption({ value: TOKEN_B_ADDRESS });
    await page.getByLabel(/monto a recibir/i).fill("7");
    await page.getByRole("button", { name: /crear operaci/i }).click();
    await metamask.confirmTransaction();
    await metamask.confirmTransaction();
    await page.waitForLoadState("networkidle");

    const opsBeforeCancel = await getAllOperations(ESCROW_ADDRESS);
    const toCancel = opsBeforeCancel[opsBeforeCancel.length - 1];
    expect(Number(toCancel.status)).toBe(STATUS.ACTIVE);

    const cancelCard = page.locator("li", {
      hasText: `#${Number(toCancel.id)}`
    });
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

    // Tras cancelar, ACC1 debe recuperar sus 5 TKA (balance neto = beforeCancelA)
    const afterCancelA = Number(await tokenBalance(TOKEN_A_ADDRESS, ACC1));
    expect(afterCancelA).toBeCloseTo(beforeCancelA, 6);
  });
});
