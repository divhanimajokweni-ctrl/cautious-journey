import crypto from "node:crypto";
import fs from "node:fs";

const privatePath = "./private_key.pem";
const publicPath = "./public_key.pem";

if (fs.existsSync(privatePath) || fs.existsSync(publicPath)) {
  throw new Error("KEYGEN_ABORTED_EXISTING_KEY_MATERIAL_PRESENT");
}

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 3072,
  publicExponent: 0x10001,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});

fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
fs.writeFileSync(publicPath, publicKey, { mode: 0o644 });

console.log(JSON.stringify({
  status: "KEYPAIR_GENERATED",
  algorithm: "RS256",
  modulus_bits: 3072,
  private_key: privatePath,
  public_key: publicPath
}, null, 2));
