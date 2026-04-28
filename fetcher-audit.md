### Line-by-Line Fetcher Review Checklist - Audit Results

#### ✅ Fetch Layer
- [ ] ~~Uses **abortable timeout** (no hung sockets)~~ → **FAIL**: Line 74 uses `fetch(url, { redirect: 'follow' })` with no AbortController or timeout. Risk of hung connections.
- [ ] ~~Accepts `application/octet-stream`~~ → **FAIL**: No headers specified, relies on default content negotiation.
- [x] Reads **arrayBuffer**, not text → **PASS**: Line 76-77 correctly reads arrayBuffer and converts to Buffer.
- [x] Hashes **raw bytes** (Buffer) → **PASS**: sha256 function properly hashes Buffer input.

#### ✅ Gateway Logic
- [ ] ~~≥ 5 gateways~~ → **FAIL**: DEFAULT_GATEWAYS has only 3 gateways. Should add 2 more diverse operators.
- [x] Operated by **different orgs** → **PASS**: Protocol Labs (ipfs.io), Cloudflare, Pinata - good diversity.
- [ ] ~~No single "preferred" gateway~~ → **PARTIAL**: Sequential tries mean first gateway is preferred. Consider randomizing order.
- [x] Sequential or bounded parallel (avoid swarm spikes) → **PASS**: Sequential with backoff prevents spikes.

#### ✅ Error Semantics
- [x] HTTP errors ≠ hash mismatch → **PASS**: Line 75 throws on !res.ok, treating as fetch failure, not content mismatch.
- [ ] ~~Timeout ≠ legal change~~ → **FAIL**: No timeout implemented - infinite hangs possible, could mask real issues.
- [x] Network partition logged, not enforced → **PASS**: Errors logged via logEvent, status marked as 'unreachable'.

#### ✅ Circuit Criteria
- [x] Never trip if `successes.length === 0` → **PASS**: Sets status='unreachable', doesn't trigger circuit breaker.
- [ ] ~~Require ≥ 2 mismatched hashes~~ → **FAIL**: Logic only checks first successful fetch. No quorum for hash verification.
- [x] Retry cycle before enforcement → **PASS**: backoff() with exponential delay before giving up.
- [ ] ~~Log evidence before on-chain action~~ → **PARTIAL**: Logs errors but no structured evidence collection for hash mismatches.

### Overall Assessment: **NEEDS UPGRADE**

Current fetcher.js is **not regulator-defensible** due to:
1. No timeout protection (DoS risk)
2. Insufficient gateway diversity (only 3/5 recommended)
3. No hash quorum verification (single point of failure)
4. Missing content-type headers

**Recommended**: Replace with ipfsResolver.js module for production safety.