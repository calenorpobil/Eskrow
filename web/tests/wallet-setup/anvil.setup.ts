import { defineWalletSetup } from "@synthetixio/synpress";
import { MetaMask } from "@synthetixio/synpress/playwright";

export const SEED_PHRASE =
  "test test test test test test test test test test test junk";
export const PASSWORD = "Tester@1234";

export const ANVIL_NETWORK = {
  name: "Anvil",
  rpcUrl: "http://localhost:8545",
  chainId: 31337,
  symbol: "ETH"
};

export default defineWalletSetup(SEED_PHRASE, async (context, walletPage) => {
  const metamask = new MetaMask(context, walletPage, PASSWORD);
  await metamask.importWallet(SEED_PHRASE);
  await metamask.addNetwork(ANVIL_NETWORK);
  await metamask.switchNetwork(ANVIL_NETWORK.name);
  await metamask.addNewAccount("Anvil #1");
  await metamask.addNewAccount("Anvil #2");
  await metamask.switchAccount("Account 1");
});
