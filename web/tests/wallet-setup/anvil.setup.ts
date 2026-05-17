import { defineWalletSetup } from "@synthetixio/synpress";
import { MetaMask } from "@synthetixio/synpress/playwright";

// Anvil's default deterministic mnemonic — gives accounts #0…#9 with known private keys.
// Account #0: 0xf39Fd6e51AAd88F6F4cE6Ab8827279cFFFb92266
// Account #1: 0x70997970C51812dc3A010C7d01b50e0d17DC79c8
// Account #2: 0x3C44CdDdB6a900FA2b585dD299E03D12FA4293Bc
export const SEED_PHRASE =
  "test test test test test test test test test test test junk";
export const PASSWORD = "Tester@1234";

export const ANVIL_NETWORK = {
  name: "Anvil",
  rpcUrl: "http://localhost:8545",
  chainId: 31337,
  symbol: "ETH"
};

export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, PASSWORD);

  // Import the deterministic Anvil seed — account #0 is derived automatically.
  await metamask.importWallet(SEED_PHRASE);

  // Add the local Anvil network.
  await metamask.addNetwork(ANVIL_NETWORK);
  await metamask.switchNetwork(ANVIL_NETWORK.name);

  // Derive accounts #1 and #2 from the same seed (BIP44 next indexes).
  await metamask.addNewAccount("Anvil #1");
  await metamask.addNewAccount("Anvil #2");

  // Leave the wallet on account #0 (creator of operations).
  await metamask.switchAccount("Account 1");
});
