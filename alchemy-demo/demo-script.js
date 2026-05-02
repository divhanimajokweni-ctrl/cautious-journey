const { createPublicClient, http } = require("viem");

const client = createPublicClient({
  transport: http("https://polygon-mainnet.g.alchemy.com/v2/MMq1M8DrcNvUtBPWyVOSB"),
});

async function main() {
    console.log("=== Alchemy Polygon PoS API Demo ===\n");

    // Get the latest block number
    const blockNumber = await client.getBlockNumber();
    console.log("Current block number:", blockNumber);

    // Get an address balance
    const balance = await client.getBalance({ address: "0xab5801a7d398351b8be11c439e05c5b3259aec9b" });
    console.log("Balance (MATIC):", Number(balance) / 1e18);

    // Read block data
    const block = await client.getBlock({ blockNumber });
    console.log("Block:", block);

    // Fetch a transaction by hash
    const txHash = "0x7ae597f01a9c8de356a12eeb656cded7807ae75cf22ab2cbd34ad5aeb8f1ae57";
    const tx = await client.getTransaction({ hash: txHash });
    console.log("Transaction:", tx);

    // Fetch a transaction receipt
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    console.log("Receipt:", receipt);
}

main().catch(console.error);