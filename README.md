# gettele.app

the tele website: a telegram-like page where every section is a chat

- `yarn dev` runs it locally. the feature list is read from a tele checkout at `.tele` (or `TELE_REPO`) and from github's release api
- `src/chats.ts` holds every message, `src/markup.tsx` the message formatting
- `/scripting` is the scripting reference: `docs/scripting.md` from the tele checkout, split into sections and items by `scripts/data.mjs` and rendered by `src/scripting.tsx` and `src/doc.tsx`. for ai agents the same file is also split into `/scripting/SKILL.md` (the intro and an index of every section and entry) and `/scripting/reference/<section>.md`, so an agent loads only the sections it needs
- `/scripting/catalog` lists ready-made scripts: `docs/scripts/index.json` from the tele checkout (built there by `docs/scripts/build-index.mjs`), rendered by `src/catalog.tsx`. `scripts/data.mjs` copies every `docs/scripts/<id>/script.ts` to `/scripting/catalog/<id>.ts`, the link tele installs from: `tg://tele/script?url=<that link>` opens tele's install box with it filled in
- `scripts/deploy.sh` pulls, rebuilds when this repo, tele or its latest release changed, and swaps `dist` in place
