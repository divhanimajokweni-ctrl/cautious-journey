# DNS Update Instructions for venturevisionubuntu.co.za

Nameservers currently remain with the third-party DNS host:

```txt
ns1.host-ww.net
ns2.host-ww.net
ns3.host-ww.net
ns4.host-ww.net
```

Vercel can also manage the zone directly if the registrar nameservers are changed to:

```txt
ns1.vercel-dns.com
ns2.vercel-dns.com
```

Until that migration is done, keep the third-party nameservers and set the records below in the host-ww.net / cloud2m.co.za DNS panel.

## Required Vercel Records

Delete conflicting A, AAAA, or CNAME records for `@`, `www`, and `api`, then set:

```txt
Type: A  | Host: @    | Value: 76.76.21.21 | TTL: 300
Type: A  | Host: www  | Value: 76.76.21.21 | TTL: 300
Type: A  | Host: api  | Value: 76.76.21.21 | TTL: 300
```

Do not point `@` or `www` to GitHub Pages IPs for this deployment. Do not set `www` as a CNAME to the apex; Vercel currently requires `A www.venturevisionubuntu.co.za 76.76.21.21` for certificate verification under the existing third-party nameserver setup.

## Optional Verification TXT

The previous GitHub Pages TXT record is not required for the Vercel deployment. It may remain harmlessly if you still use GitHub Pages elsewhere, but it does not configure this Vercel project.

```txt
Type: TXT | Host: _github-pages-challenge-divhanimajokweni-ctrl | Value: "959b84c8ec710837b5ee4f82b56e98"
```

## Vercel Aliases

The current production deployment should be aliased to:

```txt
venturevisionubuntu.co.za
www.venturevisionubuntu.co.za
api.venturevisionubuntu.co.za
```

If a domain still points at an older deployment, reassign it with:

```sh
vercel alias set <current-production-url> venturevisionubuntu.co.za
vercel alias set <current-production-url> api.venturevisionubuntu.co.za
vercel alias set <current-production-url> www.venturevisionubuntu.co.za
```

## Verify

```sh
nslookup venturevisionubuntu.co.za
nslookup www.venturevisionubuntu.co.za
nslookup api.venturevisionubuntu.co.za
curl -I https://venturevisionubuntu.co.za/
curl -I https://www.venturevisionubuntu.co.za/
curl -I https://api.venturevisionubuntu.co.za/api/health
```

Expected DNS answer for all three hostnames:

```txt
76.76.21.21
```

Expected HTTP result after Vercel certificate issuance:

```txt
HTTP/2 200
server: Vercel
```
