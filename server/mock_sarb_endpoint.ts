import http from "node:http";
import fs from "node:fs";
import { ProofBridgeComplianceTokenizer } from "../prover/compliance_tokenizer.js";

const PORT = Number(process.env.PORT ?? 8080);
const PUBLIC_KEY_PATH = process.env.PUBLIC_KEY_PATH ?? "./public_key.pem";
const MAX_BODY_BYTES = 64_000;

const tokenizer = new ProofBridgeComplianceTokenizer();

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/api/sarb/bop3-ingest") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "REJECTED", error: "NOT_FOUND" }));
    return;
  }

  let size = 0;
  const chunks: Buffer[] = [];
  let rejected = false;

  req.on("data", chunk => {
    if (rejected) return;
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      rejected = true;
      res.writeHead(413, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "REJECTED", error: "BODY_TOO_LARGE" }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", () => {
    if (rejected) return;

    try {
      const publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, "utf8");
      const body = Buffer.concat(chunks).toString("utf8");
      const verified = tokenizer.verifyComplianceLog(body, publicKeyPem);

      if (!verified) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "REJECTED", error: "CRYPTOGRAPHIC_SIGNATURE_VIOLATION" }));
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        status: "ACCEPTED",
        message: "SARB_BOP3_ISO20022_COMPLIANCE_PACKET_VERIFIED",
        timestamp: new Date().toISOString()
      }));
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "REJECTED", error: "MALFORMED_OR_UNVERIFIABLE_PACKET" }));
    }
  });
});

server.listen(PORT, () => {
  console.log(JSON.stringify({
    status: "MOCK_SARB_ENDPOINT_ONLINE",
    endpoint: `http://localhost:${PORT}/api/sarb/bop3-ingest`
  }));
});
