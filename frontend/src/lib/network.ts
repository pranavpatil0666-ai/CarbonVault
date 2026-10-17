export async function switchToLocalhost() {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    alert("No web3 wallet found. Please install MetaMask or Brave Wallet.");
    return false;
  }

  const ethereum = (window as any).ethereum;
  const hardhatChainIdHex = "0x7a69"; // 31337 in hex

  try {
    // Attempt standard switch
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hardhatChainIdHex }],
    });
    return true;
  } catch (switchError: any) {
    // 4902 error code means the chain is not added to the wallet yet
    if (switchError.code === 4902 || switchError.message?.includes("Unrecognized chain")) {
      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hardhatChainIdHex,
              chainName: "Hardhat Localhost 8545",
              rpcUrls: ["http://127.0.0.1:8545"],
              nativeCurrency: {
                name: "Ethereum",
                symbol: "ETH",
                decimals: 18,
              },
            },
          ],
        });
        return true;
      } catch (addError) {
        console.error("Failed to add Localhost network:", addError);
        return false;
      }
    } else {
      console.error("Failed to switch network:", switchError);
      return false;
    }
  }
}
