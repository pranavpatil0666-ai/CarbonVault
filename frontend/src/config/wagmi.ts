import { http, createConfig } from "wagmi";
import { sepolia, hardhat, localhost } from "wagmi/chains";
import { injected } from "@wagmi/core";
import { fallback } from "viem";

export const wagmiConfig = createConfig({
  chains: [sepolia, hardhat, localhost],
  connectors: [injected()],
  transports: {
    [sepolia.id]: fallback([
      http(process.env.NEXT_PUBLIC_SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com"),
      http("https://sepolia.drpc.org"),
      http("https://1rpc.io/sepolia"),
      http("https://rpc.sepolia.org"),
    ]),
    [hardhat.id]: http("http://127.0.0.1:8545"),
    [localhost.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});
