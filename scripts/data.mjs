import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const repo = process.env.TELE_REPO ?? new URL('../.tele', import.meta.url).pathname
const github = 'nitreojs/tele'
const out = new URL('../src/data.json', import.meta.url)

const plain = (s) =>
  s
    .replace(/\\\|/g, '|')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()

const stat = (path) => {
  let added = 0
  let removed = 0
  const file = join(repo, 'docs', path)
  if (!existsSync(file)) return { added, removed }
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue
    if (line.startsWith('+')) added++
    else if (line.startsWith('-')) removed++
  }
  return { added, removed }
}

const rowPattern = /^\| \[(\d+)\]\(([^)]+)\) \| (.+) \| (.*) \|$/

const features = new Map()
let section = ''
for (const line of readFileSync(join(repo, 'docs/features.md'), 'utf8').split('\n')) {
  const heading = line.match(/^## (.+)$/)
  if (heading) section = heading[1]
  const row = line.match(rowPattern)
  if (!row || !section) continue
  const [, number, path, text, toggle] = row
  features.set(Number(number), {
    number: Number(number),
    text: plain(text),
    toggle: plain(toggle),
    tag: section.replace(/\s+/g, '_'),
    patch: `https://github.com/${github}/blob/main/${path.replace(/^\.\.\//, '')}`,
    ...stat(path),
  })
}

let release = ''
for (const line of readFileSync(join(repo, 'docs/releases.md'), 'utf8').split('\n')) {
  const heading = line.match(/^### \[tele (\d+)\]\(.+\/tag\/([^)]+)\)/)
  if (heading) release = heading[2]
  const row = line.match(rowPattern)
  if (row && release && features.has(Number(row[1]))) features.get(Number(row[1])).release = release
}

const scriptingFile = join(repo, 'docs/scripting.md')
const scriptingOut = new URL('../src/scripting.json', import.meta.url)
const skillDir = new URL('../public/scripting/', import.meta.url)

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item'

const githubSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\p{M}\p{Pc} -]/gu, '')
    .replace(/ /g, '-')

const scripting = { title: '', intro: '', sections: [] }
const skill = existsSync(scriptingFile)
rmSync(skillDir, { recursive: true, force: true })
if (skill) {
  mkdirSync(skillDir, { recursive: true })
  copyFileSync(scriptingFile, new URL('SKILL.md', skillDir))

  const ids = new Set()
  const unique = (base) => {
    let id = base
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`
    ids.add(id)
    return id
  }
  const anchors = new Map()
  const seen = new Map()
  const anchor = (text, id) => {
    const base = githubSlug(text)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    if (id) anchors.set(count ? `${base}-${count}` : base, id)
  }

  const intro = { lines: [] }
  let target = intro
  let fence = false
  const source = readFileSync(scriptingFile, 'utf8').replace(/\r\n/g, '\n').replace(/^---\n[\s\S]*?\n---\n/, '')
  for (const line of source.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    const heading = !fence && line.match(/^(#{1,6}) (.+?)\s*$/)
    if (heading && heading[1] === '#' && target === intro && !scripting.title) {
      scripting.title = heading[2]
      anchor(heading[2])
    } else if (heading && heading[1] === '##') {
      const id = unique(slug(heading[2]))
      anchor(heading[2], id)
      target = { id, title: heading[2], lines: [], items: [] }
      scripting.sections.push(target)
    } else if (heading && heading[1] === '###' && scripting.sections.length) {
      const id = unique(slug(heading[2]))
      anchor(heading[2], id)
      target = { id, title: heading[2], lines: [] }
      scripting.sections.at(-1).items.push(target)
    } else {
      if (heading) anchor(heading[2])
      target.lines.push(line)
    }
  }

  const body = ({ lines }) =>
    lines
      .join('\n')
      .trim()
      .replace(/\]\((?:\.?\/?scripting\.md)?#([^)\s]+)\)/g, (_, to) => `](/scripting/${anchors.get(to) ?? to})`)

  scripting.intro = body(intro)
  scripting.sections = scripting.sections.map((s) => ({
    id: s.id,
    title: s.title,
    intro: body(s),
    items: s.items.map((i) => ({ id: i.id, title: i.title, body: body(i) })),
  }))
}
scripting.title ||= 'scripting'
writeFileSync(scriptingOut, JSON.stringify(scripting, null, 1))
console.log(
  skill
    ? `scripting.json: ${scripting.sections.length} sections, ${scripting.sections.reduce((n, s) => n + s.items.length, 0)} items, SKILL.md copied`
    : `scripting.json: no ${scriptingFile}, wrote an empty reference`,
)

let releases
try {
  const response = await fetch(`https://api.github.com/repos/${github}/releases?per_page=100`, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'gettele.app' },
  })
  if (!response.ok) throw new Error(`github answered ${response.status}`)
  releases = (await response.json()).map((r) => ({
    tag: r.tag_name,
    date: r.published_at,
    assets: r.assets.map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })),
  }))
} catch (error) {
  if (!existsSync(out)) throw error
  console.warn(`releases: ${error.message}, keeping the previous list`)
  releases = JSON.parse(readFileSync(out, 'utf8')).releases
}

const dates = new Map(releases.map((r) => [r.tag, r.date]))
const rows = [...features.values()]
  .filter((f) => dates.has(f.release))
  .map((f) => ({ ...f, date: dates.get(f.release) }))
  .sort((a, b) => a.date.localeCompare(b.date) || a.number - b.number)

const latest = releases.find((r) => r.assets.some((a) => a.name === 'tele-update-win64.json'))
let zipSha256 = ''
try {
  const feed = await (await fetch(latest.assets.find((a) => a.name === 'tele-update-win64.json').url)).json()
  zipSha256 = JSON.parse(Buffer.from(feed.feed, 'base64').toString('utf8')).zip_sha256
} catch (error) {
  console.warn(`feed: ${error.message}`)
}

writeFileSync(out, JSON.stringify({ latest: { tag: latest.tag, zipSha256 }, releases, features: rows }, null, 1))
console.log(`data.json: ${rows.length} of ${features.size} features, ${releases.length} releases, latest ${latest.tag} ${zipSha256}`)
