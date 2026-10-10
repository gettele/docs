import { readFileSync, writeFileSync, existsSync } from 'node:fs'
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
