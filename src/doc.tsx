import { useMemo } from 'preact/hooks'
import { Inlines, Pre, parseInline, type Inline } from './markup'

type Align = 'left' | 'center' | 'right' | undefined

type DocBlock =
  | { type: 'p'; children: Inline[] }
  | { type: 'heading'; level: number; children: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: DocBlock[][] }
  | { type: 'quote'; blocks: DocBlock[] }
  | { type: 'pre'; lang: string; code: string }
  | { type: 'table'; align: Align[]; head: Inline[][]; rows: Inline[][][] }
  | { type: 'divider' }

const fencePattern = /^(\s*)(```|~~~)\s*([\w+-]*)\s*$/
const headingPattern = /^(#{1,6})\s+(.+?)\s*$/
const itemPattern = /^(\s*)([-*+]|\d+[.)])(\s+)(.*)$/
const dividerPattern = /^\s*([-*_])(\s*\1){2,}\s*$/
const delimiterPattern = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

const indent = (line: string) => line.match(/^\s*/)![0].length

const isTable = (lines: string[], i: number) =>
  lines[i].trim().startsWith('|') && i + 1 < lines.length && delimiterPattern.test(lines[i + 1]) && lines[i + 1].includes('-')

const startsBlock = (lines: string[], i: number) =>
  fencePattern.test(lines[i]) ||
  headingPattern.test(lines[i]) ||
  itemPattern.test(lines[i]) ||
  lines[i].trimStart().startsWith('>') ||
  dividerPattern.test(lines[i]) ||
  isTable(lines, i)

function cells(row: string): string[] {
  const out: string[] = []
  let cell = ''
  let code = false
  const text = row.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '')
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '\\' && text[i + 1] === '|') {
      cell += '|'
      i++
    } else if (c === '`') {
      code = !code
      cell += c
    } else if (c === '|' && !code) {
      out.push(cell.trim())
      cell = ''
    } else cell += c
  }
  out.push(cell.trim())
  return out
}

function parseList(lines: string[], from: number): [DocBlock, number] {
  const first = lines[from].match(itemPattern)!
  const base = first[1].length
  const ordered = /\d/.test(first[2])
  const items: string[][] = []
  let content = 0
  let i = from
  for (; i < lines.length; i++) {
    const line = lines[i]
    const item = line.match(itemPattern)
    if (item && item[1].length === base) {
      if (/\d/.test(item[2]) !== ordered) break
      content = base + item[2].length + Math.min(item[3].length, 4)
      items.push([item[4]])
    } else if (!line.trim()) {
      let next = i + 1
      while (next < lines.length && !lines[next].trim()) next++
      if (next >= lines.length) break
      const nextItem = lines[next].match(itemPattern)
      if (indent(lines[next]) <= base && !(nextItem && nextItem[1].length === base)) break
      items.at(-1)!.push('')
    } else if (indent(line) > base) {
      items.at(-1)!.push(line.slice(Math.min(indent(line), content)))
    } else if (!startsBlock(lines, i) && items.at(-1)!.at(-1)) {
      items.at(-1)!.push(line.trim())
    } else break
  }
  return [{ type: 'list', ordered, start: ordered ? parseInt(first[2]) : 1, items: items.map(parseDoc) }, i]
}

function parseDoc(source: string | string[]): DocBlock[] {
  const lines = typeof source === 'string' ? source.replace(/\t/g, '    ').split('\n') : source
  const blocks: DocBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = line.match(fencePattern)
    const heading = line.match(headingPattern)
    if (!line.trim()) {
      i++
    } else if (fence) {
      const code: string[] = []
      const strip = fence[1].length
      for (i++; i < lines.length && !(lines[i].trim().startsWith(fence[2]) && /^[`~]+$/.test(lines[i].trim())); i++)
        code.push(lines[i].slice(Math.min(indent(lines[i]), strip)))
      blocks.push({ type: 'pre', lang: fence[3], code: code.join('\n') })
      i++
    } else if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, children: parseInline(heading[2]) })
      i++
    } else if (dividerPattern.test(line)) {
      blocks.push({ type: 'divider' })
      i++
    } else if (line.trimStart().startsWith('>')) {
      const quote: string[] = []
      for (; i < lines.length && lines[i].trimStart().startsWith('>'); i++) quote.push(lines[i].trimStart().replace(/^>\s?/, ''))
      blocks.push({ type: 'quote', blocks: parseDoc(quote) })
    } else if (isTable(lines, i)) {
      const head = cells(lines[i])
      const align = cells(lines[i + 1]).map((c): Align =>
        c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : undefined,
      )
      const rows: Inline[][][] = []
      for (i += 2; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(cells(lines[i]).map(parseInline))
      blocks.push({ type: 'table', align, head: head.map(parseInline), rows })
    } else if (itemPattern.test(line)) {
      const [list, next] = parseList(lines, i)
      blocks.push(list)
      i = next
    } else {
      const para: string[] = []
      for (; i < lines.length && lines[i].trim() && !startsBlock(lines, i); i++) para.push(lines[i].trim())
      blocks.push({ type: 'p', children: parseInline(para.join(' ')) })
    }
  }
  return blocks
}

function Blocks({ blocks, tight }: { blocks: DocBlock[]; tight?: boolean }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'p':
            return tight && i === 0 ? (
              <Inlines key={i} nodes={b.children} />
            ) : (
              <p key={i}>
                <Inlines nodes={b.children} />
              </p>
            )
          case 'heading': {
            const Tag = `h${b.level}` as 'h2'
            return (
              <Tag key={i}>
                <Inlines nodes={b.children} />
              </Tag>
            )
          }
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul'
            return (
              <Tag key={i} start={b.ordered && b.start !== 1 ? b.start : undefined}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Blocks blocks={item} tight />
                  </li>
                ))}
              </Tag>
            )
          }
          case 'quote':
            return (
              <blockquote key={i}>
                <Blocks blocks={b.blocks} />
              </blockquote>
            )
          case 'pre':
            return <Pre key={i} lang={b.lang} code={b.code} />
          case 'table':
            return (
              <div key={i} class="doc-table">
                <table>
                  <thead>
                    <tr>
                      {b.head.map((cell, j) => (
                        <th key={j} style={{ textAlign: b.align[j] }}>
                          <Inlines nodes={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, j) => (
                      <tr key={j}>
                        {b.head.map((_, k) => (
                          <td key={k} style={{ textAlign: b.align[k] }}>
                            <Inlines nodes={row[k] ?? []} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'divider':
            return <hr key={i} />
        }
      })}
    </>
  )
}

export function Doc({ source }: { source: string }) {
  const blocks = useMemo(() => parseDoc(source), [source])
  return <Blocks blocks={blocks} />
}
