# gettele.app

the tele website: a telegram-like page where every section is a chat

- `yarn dev` runs it locally. the feature list is read from a tele checkout at `.tele` (or `TELE_REPO`) and from github's release api
- `src/chats.ts` holds every message, `src/markup.tsx` the message formatting
- `scripts/deploy.sh` pulls, rebuilds when this repo, tele or its latest release changed, and swaps `dist` in place
