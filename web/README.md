# Commish web app

The site at https://getcommish.vercel.app: the landing page, the brand console,
the creator desk, the public campaign page and the docs, in English, Bahasa
Indonesia, Español and 中文.

```bash
npm ci
npm run dev     # http://localhost:3000
npm run build
npx eslint src && npx tsc --noEmit
```

| Path | What it is |
| --- | --- |
| `src/app/[lang]/` | pages, one set per locale |
| `src/app/api/` | server routes: program account reads and the RPC proxy |
| `src/lib/commish/program.ts` | the Commish client: decoders, PDAs, instruction builders |
| `src/lib/chain.ts` | server-side `getProgramAccounts` queries |
| `src/i18n/` | dictionaries for the four locales |
| `src/components/` | UI, wallet connection and the app screens |

See the [repository README](../README.md) for how the program works.
