# gettele.app

the tele website: a telegram-like page where every section is a chat

- `yarn dev` runs it locally. the feature list is read from a tele checkout at `.tele` (or `TELE_REPO`) and from github's release api
- `src/chats.ts` holds every message, `src/markup.tsx` the message formatting
- `/scripting` is the scripting reference: `docs/scripting.md` from the tele checkout, split into sections and items by `scripts/data.mjs` and rendered by `src/scripting.tsx` and `src/doc.tsx`. the file itself is served as-is at `/scripting/SKILL.md`
- `scripts/deploy.sh` pulls, rebuilds when this repo, tele or its latest release changed, and swaps `dist` in place
