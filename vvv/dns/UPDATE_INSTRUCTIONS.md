# DNS Update Instructions for venturevisionubuntu.co.za
# Nameservers: ns1.host-ww.net, ns2.host-ww.net
# Login to your DNS hosting control panel (host-ww.net / cloud2m.co.za)

## CRITICAL RECORDS TO ADD/UPDATE

### 1. Apex A Records (ADD these 4, DELETE any existing A records for @)
Type: A  |  Name/Host: @ (or leave blank)  |  Value/Points to: 185.199.108.153  |  TTL: 300 (5min)
Type: A  |  Name/Host: @                   |  Value: 185.199.109.153          |  TTL: 300
Type: A  |  Name/Host: @                   |  Value: 185.199.110.153          |  TTL: 300
Type: A  |  Name/Host: @                   |  Value: 185.199.111.153          |  TTL: 300

### 2. WWW CNAME (ADD or UPDATE)
Type: CNAME  |  Name/Host: www  |  Value: divhanimajokweni-ctrl.github.io.  |  TTL: 14400

### 3. TXT Verification (ADD if missing, or VERIFY exact value)
Type: TXT  |  Name/Host: _github-pages-challenge-divhanimajokweni-ctrl  |  Value: "959b84c8ec710837b5ee4f82b56e98"  |  TTL: 300

### 4. API subdomain (preserve existing if needed)
Type: A  |  Name/Host: api  |  Value: 76.76.21.21  |  TTL: 300

## REMOVE any conflicting A records for @ that point elsewhere

## After updating DNS, verify:
dig A venturevisionubuntu.co.za +short
# Should return 4 GitHub IPs above

curl -I https://venturevisionubuntu.co.za/
# Should return 200
