import {
    encodeFunctionData,
    getAddress,
    parseEther,
    stringToHex,
} from "viem";

export type EthereumProvider = {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

declare global {
    interface Window {
        ethereum?: EthereumProvider;
    }
}

const donationAbi = [
    {
        type: "function",
        name: "donate",
        stateMutability: "payable",
        inputs: [
            { name: "donationId", type: "bytes32" },
            { name: "campaignId", type: "bytes32" },
            { name: "recipient", type: "address" },
        ],
        outputs: [],
    },
] as const;

export function injectedWallet(): EthereumProvider {
    if (!window.ethereum) {
        throw new Error("Install MetaMask or another compatible wallet.");
    }
    return window.ethereum;
}

export function uuidToBytes32(value: string): `0x${string}` {
    const bytes = value.replace(/-/g, "");
    if (!/^[\da-f]{32}$/i.test(bytes)) {
        throw new Error("Invalid Fundora record ID.");
    }
    return `0x${bytes}${"0".repeat(32)}`;
}

export function encodeDonationCall(
    donationId: string,
    campaignId: string,
    recipient: `0x${string}`,
    amount: string,
) {
    return {
        data: encodeFunctionData({
            abi: donationAbi,
            functionName: "donate",
            args: [
                uuidToBytes32(donationId),
                uuidToBytes32(campaignId),
                recipient,
            ],
        }),
        value: `0x${parseEther(amount).toString(16)}`,
    };
}

export async function connectWallet(
    provider: EthereumProvider,
): Promise<`0x${string}`> {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const address = Array.isArray(accounts) ? accounts[0] : undefined;
    if (typeof address !== "string" || !/^0x[\da-f]{40}$/i.test(address)) {
        throw new Error("No valid wallet account was selected.");
    }
    return getAddress(address);
}

export async function switchWalletChain(
    provider: EthereumProvider,
    chainId: number,
) {
    const activeChain = await provider.request({ method: "eth_chainId" });
    if (
        typeof activeChain === "string" &&
        Number.parseInt(activeChain, 16) === chainId
    ) {
        return;
    }
    await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
}

export function siweMessage(
    challenge: {
        domain: string;
        uri: string;
        chain_id: number;
        nonce: string;
        statement: string;
        issued_at: string;
        expires_at: string;
    },
    walletAddress: string,
) {
    const checksummedAddress = getAddress(walletAddress);
    return [
        `${challenge.domain} wants you to sign in with your Ethereum account:`,
        checksummedAddress,
        "",
        challenge.statement,
        "",
        `URI: ${challenge.uri}`,
        "Version: 1",
        `Chain ID: ${challenge.chain_id}`,
        `Nonce: ${challenge.nonce}`,
        `Issued At: ${new Date(challenge.issued_at).toISOString()}`,
        `Expiration Time: ${new Date(challenge.expires_at).toISOString()}`,
    ].join("\n");
}

export async function signSiweMessage(
    provider: EthereumProvider,
    message: string,
    walletAddress: string,
): Promise<string> {
    const signature = await provider.request({
        method: "personal_sign",
        params: [stringToHex(message), getAddress(walletAddress)],
    });
    if (typeof signature !== "string") {
        throw new Error("The wallet did not return a signature.");
    }
    return signature;
}
