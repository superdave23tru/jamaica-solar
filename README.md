# Jamaica Solar — jamaicasolar.com.jm

Static site built with [Astro](https://astro.build), ported from the Claude Design mockup (`JamaicaSolar.dc.html`).
Hosted on Cloudflare Pages; data in Supabase.

## Run locally
```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # output in dist/
```

## Pages
| Route | What it is |
|---|---|
| `/` | Home (hero, quick links, search, featured companies, calculator promo, guides) |
| `/companies/` `/installers/` `/suppliers/` | Directory with parish / service / status filters |
| `/providers/[slug]/` | Provider profile (one page per listing) |
| `/learn/` + 4 guides | Net billing, licences & approvals, batteries, how PV works (sourced from SESR/JERA factsheets) |
| `/tools/calculator/` | Payback calculator (flags systems over the 10 kW net billing cap) |
| `/tools/inverter-check/` | Search the BSJ approved inverter list |
| `/quote/` | 5-step quote request, matched by parish |
| `/financing/` | Homeowner lenders, 30% solar tax credit, example payments |
| `/news/` + articles | Sourced policy/market news |
| `/journey/` `/methodology/` `/list-your-business/` `/contact/` `/privacy/` | Supporting pages |

## Data
Currently read from `src/data/*.json`, generated from the seed workbook:
```bash
python3 scripts/build_data.py path/to/jamaica-solar-companies-seed.xlsx path/to/bsj-approved-inverters.csv
```
Next step: load these into Supabase (`supabase/migrations/20261016_directory_schema.sql`) and read them at build time.

## Environment variables (Cloudflare Pages → Settings → Environment variables)
- `PUBLIC_SUPABASE_URL` — e.g. `https://vjjujphblniyyrhnfedr.supabase.co`
- `PUBLIC_SUPABASE_ANON_KEY` — the project's publishable/anon key

Without these, the quote form runs in "preview mode" and does not send.

## Deploy to Cloudflare Pages
1. Push this folder to a new GitHub repo.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick the repo.
3. Framework preset **Astro**, build command `npm run build`, output directory `dist`.
4. Add the environment variables above, deploy, then add the custom domain `jamaicasolar.com.jm`.

## Before launch
- Verify listings (status `Unverified` → `Verified`) and confirm calculator assumptions (J$/kWh rate, J$/kW cost).
- Apply the Supabase migration and set env vars so quotes are saved.
- Set up hello@jamaicasolar.com.jm; review the Privacy page against the Data Protection Act, 2020.
