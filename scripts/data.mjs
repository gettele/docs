import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
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
  mkdirSync(new URL('reference/', skillDir), { recursive: true })

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
  const raw = readFileSync(scriptingFile, 'utf8').replace(/\r\n/g, '\n')
  const frontmatter = raw.match(/^---\n[\s\S]*?\n---\n/)?.[0] ?? ''
  const source = raw.slice(frontmatter.length)
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

  const parsed = scripting.sections
  scripting.intro = body(intro)
  scripting.sections = parsed.map((s) => ({
    id: s.id,
    title: s.title,
    intro: body(s),
    items: s.items.map((i) => ({ id: i.id, title: i.title, body: body(i) })),
  }))

  const fileOf = new Map()
  const localAnchors = new Map()
  for (const s of parsed) {
    const here = new Map()
    for (const { id, title } of [s, ...s.items]) {
      const base = githubSlug(title)
      const count = here.get(base) ?? 0
      here.set(base, count + 1)
      fileOf.set(id, s.id)
      localAnchors.set(id, count ? `${base}-${count}` : base)
    }
  }
  const markdown = (lines, from) =>
    lines
      .join('\n')
      .trim()
      .replace(/\]\((?:\.?\/?scripting\.md)?#([^)\s]+)\)/g, (link, to) => {
        const id = anchors.get(to)
        if (!id) return link
        const file = fileOf.get(id)
        const hash = localAnchors.get(id)
        if (!from) return `](reference/${file}.md#${hash})`
        return file === from ? `](#${hash})` : `](${file}.md#${hash})`
      })

  for (const s of parsed) {
    const parts = [
      `# ${s.title}`,
      `part of the ${scripting.title} reference. the index of every section is [SKILL.md](../SKILL.md).`,
      markdown(s.lines, s.id),
      ...s.items.map((i) => `## ${i.title}\n\n${markdown(i.lines, s.id)}`),
    ]
    writeFileSync(new URL(`reference/${s.id}.md`, skillDir), parts.filter(Boolean).join('\n\n') + '\n')
  }

  const firstParagraph = (lines) =>
    markdown(lines, null)
      .split(/\n{2,}/)
      .find((p) => p && !/^(```|\||#|- |\d+\. |>)/.test(p)) ?? ''
  const link = (s) => `[${s.title}](reference/${s.id}.md)`
  const index = [
    `${frontmatter}\n# ${scripting.title}`,
    markdown(intro.lines, null),
    '## how to use this reference',
    'this file is the index. the reference itself is one file per section in `reference/`, next to this file (on the web: https://gettele.app/scripting/reference/). open only the sections you need: every entry there has its signature from `tele.d.ts`, what it does, the grant it needs, its parameters, what it returns, what it throws, and an example. links between entries point into those files.',
    `- writing a new script: read ${parsed.slice(0, 4).map(link).join(', ')} first.\n- using a method, type, event or grant: find it in the list below and open its section.`,
    '## sections',
    ...parsed.map((s) =>
      [`### ${link(s)}`, firstParagraph(s.lines), s.items.map((i) => `- ${i.title}`).join('\n')]
        .filter(Boolean)
        .join('\n\n'),
    ),
  ]
  writeFileSync(new URL('SKILL.md', skillDir), index.join('\n\n') + '\n')
}
scripting.title ||= 'scripting'
writeFileSync(scriptingOut, JSON.stringify(scripting, null, 1))
console.log(
  skill
    ? `scripting.json: ${scripting.sections.length} sections, ${scripting.sections.reduce((n, s) => n + s.items.length, 0)} items; SKILL.md and ${scripting.sections.length} reference files`
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
