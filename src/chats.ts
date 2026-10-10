import data from './data.json'
import { escape, toPlain } from './markup'

export type Message = {
  id: number
  date: string
  text?: string
  out?: boolean
  photo?: { src: string; alt: string }
  reply?: { to: number; quote?: string }
  buttons?: { text: string; href: string; icon?: string }[][]
  plain?: string
}

export type Chat = {
  id: string
  title: string
  subtitle: string
  avatar: { src?: string; letter?: string; color?: string }
  author?: string
  pinnedMessage?: { to?: number; text: string }
  pinned?: boolean
  verified?: boolean
  channel?: boolean
  openAt: 'top' | 'bottom'
  pills: 'day' | 'release'
  messages: Message[]
}

const latest = data.releases.find((r) => r.tag === data.latest.tag)!
const total = data.features.length
const asset = (suffix: string) => latest.assets.find((a) => a.name.endsWith(suffix))!
const zip = asset('-win64.zip')

const at = (start: string) => {
  let t = Date.parse(start)
  return () => new Date((t += 37_000)).toISOString()
}

const tele = at('2026-10-10T12:00:00Z')
const start = at('2026-10-10T12:20:00Z')
const safe = at('2026-10-10T13:05:00Z')
const scripts = at('2026-10-10T14:30:00Z')

const transcript = [
  `Loaded digest sha256:${data.latest.zipSha256} for file://${zip.name}`,
  'Loaded 1 attestation from GitHub API',
  '',
  'The following policy criteria will be enforced:',
  '- Predicate type must match:................ https://slsa.dev/provenance/v1',
  '- Source Repository Owner URI must match:... https://github.com/nitreojs',
  '- Source Repository URI must match:......... https://github.com/nitreojs/tele',
  '- Subject Alternative Name must match regex: (?i)^https://github.com/nitreojs/tele/',
  '- OIDC Issuer must match:................... https://token.actions.githubusercontent.com',
  '',
  '✓ Verification succeeded!',
]

const mb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`

export const chats: Chat[] = [
  {
    id: 'tele',
    title: 'tele',
    subtitle: 'channel',
    avatar: { src: '/tele.jpg' },
    pinned: true,
    verified: true,
    channel: true,
    openAt: 'top',
    pills: 'day',
    messages: [
      {
        id: 1,
        date: tele(),
        photo: { src: '/screenshot.png', alt: 'settings → tele' },
        text: 'this is settings → tele. everything we add lives here, right under language',
      },
      {
        id: 2,
        date: tele(),
        text: "tele is telegram desktop with extra stuff added on top. you log in with your usual telegram account and everything is where you left it: chats, folders, stickers. it's not a different messenger, and the people you talk to don't need it",
      },
      {
        id: 3,
        date: tele(),
        text: "every time telegram puts out a new version of their desktop app, we take that exact code, add our changes and build tele again. so you're never stuck on an old telegram",
      },
      { id: 4, date: tele(), text: "it doesn't touch the telegram you already have. keep both if you want" },
      {
        id: 5,
        date: tele(),
        text: `most of the extras are off until you turn them on. there are [${total} of them](/features) so far, and [where to start](/start) has the ones people like most`,
      },
      {
        id: 6,
        date: tele(),
        text: "![🔒](tg://emoji?id=5258476306152038031) downloaded tele from somewhere and not sure it's really ours? [here's how to check](/safe)",
      },
      {
        id: 7,
        date: tele(),
        text: "tele is free and its code is [on github](https://github.com/nitreojs/tele). it isn't made by telegram and isn't affiliated with it",
        buttons: [[{ text: 'download', href: '/download' }]],
      },
    ],
  },
  {
    id: 'start',
    title: 'where to start',
    subtitle: 'channel',
    avatar: { letter: 'w', color: 'orange' },
    channel: true,
    openAt: 'top',
    pills: 'day',
    messages: [
      [32, 'ghost mode', 'read messages without the other person seeing it. same for typing, being online and watching stories, for every chat or only some'],
      [19, 'deleted messages stay', 'when someone deletes a message, you still see it, marked as deleted. even after a restart if you want'],
      [197, 'gift studio', 'build any collectible gift from its real parts and save it as a picture, a video or a sticker'],
      [87, 'shots', 'turn a few messages into one picture, with the chat background or without it'],
      [195, 'mtproto console', "for the curious: talk to telegram's servers directly with your own account and see exactly what comes back"],
      [6, 'updates itself', 'and checks that every update really came from us before installing it'],
    ]
      .map(([n, name, text], i) => ({ id: i + 1, date: start(), text: `**[${name}](/features/${n})**\n${text}` }))
      .concat({
        id: 7,
        date: start(),
        text: `that's 6 out of ${total}. the rest are in [features](/features), and you can search them. try #privacy`,
      }),
  },
  {
    id: 'features',
    title: 'features',
    subtitle: `${total} posts`,
    avatar: { letter: 'f', color: 'green' },
    channel: true,
    pinnedMessage: { text: `every post is one thing tele changes, ${total} so far. click a #hashtag to see a whole settings page` },
    openAt: 'bottom',
    pills: 'release',
    messages: data.features.map((f) => ({
      id: f.number,
      date: f.date,
      text: `${escape(f.text)}\n\n${escape(f.toggle.replace(/^tele → /, 'settings → tele → ').replace(/, /g, ' · ')).replace(
        /\b(with|see) (\d+)\b/g,
        (_, word, n) => `${word === 'with' ? 'follows' : 'see'} [${n}](/features/${n})`,
      )}\n#${f.tag} · [patch ${f.number}](${f.patch})`,
    })),
  },
  {
    id: 'safe',
    title: 'is it safe?',
    subtitle: 'a conversation',
    author: 'tele',
    avatar: { letter: 'i', color: 'red' },
    openAt: 'top',
    pills: 'day',
    messages: [
      { id: 1, date: safe(), out: true, text: 'how do i know the tele i downloaded is really yours?' },
      {
        id: 2,
        date: safe(),
        text: 'fair question. anyone can upload a file and call it tele.exe, so here is how to check that yours was made by github from our public code, and not by one of us on a laptop or by someone else entirely',
      },
      {
        id: 3,
        date: safe(),
        text: 'every time we release, github writes a receipt: which file came out, which code it was built from and which build made it. github signs the receipt and keeps it public, so anyone can ask github “do you have a receipt for this exact file?”',
      },
      { id: 4, date: safe(), out: true, text: "how does it know it's the exact same file?" },
      {
        id: 5,
        date: safe(),
        text: 'by its fingerprint (programmers call it a hash): a short code calculated from every byte of the file. change one byte and you get a completely different fingerprint',
      },
      { id: 6, date: safe(), out: true, text: 'ok, how do i check' },
      {
        id: 7,
        date: safe(),
        text: `1. install the github cli from [cli.github.com](https://cli.github.com) and log in once with \`gh auth login\`\n2. open a terminal in the folder with your download\n3. run this, with your file's name:\n\`\`\`bash\ngh attestation verify ${zip.name} --repo nitreojs/tele\n\`\`\``,
      },
      { id: 8, date: safe(), text: `you'll see something like this:\n\`\`\`\n${transcript.join('\n')}\n\`\`\`` },
      { id: 9, date: safe(), reply: { to: 8, quote: transcript[0] }, text: 'your file’s fingerprint, calculated on your computer' },
      { id: 10, date: safe(), reply: { to: 8, quote: transcript[1] }, text: 'github has one receipt for exactly this fingerprint' },
      { id: 11, date: safe(), reply: { to: 8, quote: transcript[6] }, text: 'the receipt says the file was built from our code, not from a copy of it' },
      { id: 12, date: safe(), reply: { to: 8, quote: transcript[8] }, text: "and it was signed by github's build machines, not by a person" },
      { id: 13, date: safe(), reply: { to: 8, quote: transcript[10] }, text: '![✅](tg://emoji?id=5260416304224936047) this is the line you want' },
      { id: 14, date: safe(), out: true, text: 'and if it says something else?' },
      {
        id: 15,
        date: safe(),
        text: "then don't run it, and [tell us](https://github.com/nitreojs/tele/issues) where you got it",
      },
    ],
  },
  {
    id: 'scripts',
    title: 'scripts',
    subtitle: 'coming soon',
    avatar: { letter: 's', color: 'cyan' },
    channel: true,
    pinnedMessage: { to: 1, text: 'not in any release yet' },
    openAt: 'top',
    pills: 'day',
    messages: [
      {
        id: 1,
        date: scripts(),
        text: 'scripts are small programs you write yourself that run inside tele. they can answer messages, change what you send before it leaves, and react to anything that happens in your account',
      },
      {
        id: 2,
        date: scripts(),
        text: "you'll need to know some javascript or typescript. this one turns every “ping” you send into “pong”:\n```ts\nexport default defineScript({\n  name: 'ping pong',\n  grants: ['interceptRpc(messages.sendMessage)'],\n  setup(tg) {\n    tg.interceptRpc('messages.sendMessage', ({ request }, next) => {\n      if (request.message === 'ping') request.message = 'pong'\n      return next()\n    })\n  },\n})\n```",
      },
      {
        id: 3,
        date: scripts(),
        text: 'every script lists what it needs, and tele asks you before it gets any of it',
      },
      { id: 4, date: scripts(), text: "we'll post the full docs here when scripts ship" },
    ],
  },
  {
    id: 'download',
    title: 'download',
    subtitle: latest.tag,
    avatar: { letter: 'd', color: 'blue' },
    channel: true,
    openAt: 'top',
    pills: 'day',
    messages: [
      {
        id: 1,
        date: latest.date,
        text: `![⬇️](tg://emoji?id=6037157012242960559) **tele ${latest.tag.replace(/^v[\d.]+-tele\./, '')}**, built on telegram desktop ${latest.tag.replace(/-tele\.\d+$/, '')}`,
        buttons: [
          [
            { text: `windows · ${mb(zip.size)}`, href: zip.url, icon: '6298333093044422573' },
            { text: `linux · ${mb(asset('-linux64.zip').size)}`, href: asset('-linux64.zip').url, icon: '5850237475720532199' },
            { text: `macos · ${mb(asset('-macos.dmg').size)}`, href: asset('-macos.dmg').url, icon: '5303166548968483243' },
          ],
        ],
      },
      {
        id: 2,
        date: latest.date,
        text: '![🪟](tg://emoji?id=6298333093044422573) **windows**: unpack the zip anywhere and run tele.exe. it keeps its data in the same folder and adds itself to the start menu',
      },
      {
        id: 3,
        date: latest.date,
        text: '![🐧](tg://emoji?id=5850237475720532199) **linux**: unpack it somewhere you can write to, like `~/.local/opt/tele`, and run `./tele`. your data goes to `~/.local/share/tele`',
      },
      {
        id: 4,
        date: latest.date,
        text: "![🍎](tg://emoji?id=5303166548968483243) **macos**: drag tele into applications. it isn't notarized, so run this once before opening it:\n```bash\nxattr -dr com.apple.quarantine /Applications/tele.app\n```",
      },
      {
        id: 5,
        date: latest.date,
        text: "after that tele updates itself: it checks every 3 hours and asks you to restart when a new version is ready. not sure your download is really ours? [check it](/safe)",
      },
      { id: 6, date: latest.date, text: 'older versions are [on github](https://github.com/nitreojs/tele/releases)' },
    ],
  },
]

for (const chat of chats) for (const m of chat.messages) m.plain = toPlain(m.text ?? '')

export const releaseName = (date: string) => {
  const r = data.releases.find((x) => x.date === date)
  return r ? `tele ${r.tag.replace(/^v[\d.]+-tele\./, '')}` : ''
}
