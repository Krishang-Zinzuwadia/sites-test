#!/usr/bin/env node
// Direct-upload protocol and hash algorithm:
// https://developers.cloudflare.com/workers/static-assets/direct-upload/
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

const assetsDirectory = path.resolve(__dirname, '../.cloudflare/output/v0/workers/default/assets')
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
}

function hashAsset(contents, filename) {
  const extension = path.extname(filename).substring(1)
  return crypto.createHash('sha256').update(contents.toString('base64') + extension).digest('hex').slice(0, 32)
}

async function collectAssets(directory = assetsDirectory) {
  const manifest = {}
  const files = []
  async function visit(current, relative = '') {
    const entries = await fs.readdir(current, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const filename = path.join(current, entry.name)
      const relativePath = path.join(relative, entry.name)
      if (entry.isDirectory()) await visit(filename, relativePath)
      else if (entry.isFile()) {
        const contents = await fs.readFile(filename)
        const assetPath = '/' + relativePath.split(path.sep).join('/')
        const hash = hashAsset(contents, relativePath)
        manifest[assetPath] = { hash, size: contents.length }
        files.push({ path: assetPath, hash, size: contents.length,
          contentType: contentTypes[path.extname(relativePath).toLowerCase()] || 'application/octet-stream' })
      } else throw new Error('Asset output contains an unsupported filesystem entry')
    }
  }
  await visit(directory)
  if (!files.length) throw new Error('No built assets found; run npm run build:cloudflare first')
  return { manifest, files }
}

async function uploadAssets(input, fetchImplementation = fetch, directory = assetsDirectory) {
  if (!input || typeof input.jwt !== 'string' || !input.jwt ||
      !/^[a-f0-9]{32}$/.test(input.accountId || '') || !Array.isArray(input.buckets) ||
      input.buckets.some(bucket => !Array.isArray(bucket) || bucket.some(hash => !/^[a-f0-9]{32}$/.test(hash)))) {
    throw new Error('Expected JSON stdin containing jwt, buckets, and a valid accountId')
  }
  const { files } = await collectAssets(directory)
  const filesByHash = new Map(files.map(file => [file.hash, file]))
  let completionJwt = input.buckets.length === 0 ? input.jwt : undefined
  let uploadedFiles = 0
  let uploadedBytes = 0
  for (const bucket of input.buckets) {
    const form = new FormData()
    for (const hash of bucket) {
      const file = filesByHash.get(hash)
      if (!file) throw new Error('Upload session requested an unknown asset hash; rebuild and start a new session')
      const contents = await fs.readFile(path.join(directory, file.path.slice(1)))
      if (contents.length !== file.size || hashAsset(contents, file.path) !== hash) {
        throw new Error('A built asset changed after manifest creation; start a new upload session')
      }
      form.append(hash, new Blob([contents.toString('base64')], { type: file.contentType }), hash)
      uploadedFiles++
      uploadedBytes += contents.length
    }
    const response = await fetchImplementation(
      `https://api.cloudflare.com/client/v4/accounts/${input.accountId}/workers/assets/upload?base64=true`,
      { method: 'POST', headers: { Authorization: `Bearer ${input.jwt}` }, body: form,
        signal: AbortSignal.timeout(60000) },
    )
    const result = await response.json().catch(() => null)
    if (!response.ok || !result || result.success === false) {
      throw new Error(`Cloudflare asset upload failed (HTTP ${response.status})`)
    }
    if (typeof result.result?.jwt === 'string') completionJwt = result.result.jwt
  }
  if (!completionJwt) throw new Error('Cloudflare did not return a completion JWT')
  return { jwt: completionJwt, report: { uploadedFiles, uploadedBytes, totalFiles: files.length,
    buckets: input.buckets.length } }
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'manifest') return collectAssets()
  if (mode === 'upload') {
    // A PTY lets the orchestrator supply scoped upload credentials through stdin.
    // Raw mode prevents the terminal from echoing the credential back to logs.
    const raw = Boolean(process.stdin.isTTY && process.stdin.setRawMode)
    if (raw) process.stdin.setRawMode(true)
    process.stdout.write('Ready for upload JSON on stdin (input hidden).\n')
    const input = await new Promise((resolve, reject) => {
      let buffer = ''
      const onData = chunk => {
        buffer += chunk.toString('utf8')
        if (buffer.includes('\u0003')) { cleanup(); reject(new Error('Upload cancelled')); return }
        if (buffer.includes('\n')) { cleanup(); resolve(buffer.slice(0, buffer.indexOf('\n'))); }
      }
      const onEnd = () => { cleanup(); resolve(buffer) }
      const cleanup = () => {
        process.stdin.off('data', onData)
        process.stdin.off('end', onEnd)
        if (raw) process.stdin.setRawMode(false)
        process.stdin.pause()
      }
      process.stdin.on('data', onData)
      process.stdin.on('end', onEnd)
      process.stdin.resume()
    })
    return uploadAssets(JSON.parse(input))
  }
  throw new Error('Usage: node scripts/cloudflare-assets.cjs manifest|upload')
}

if (require.main === module) main().then(result => {
  process.stdout.write(JSON.stringify(result) + '\n')
}).catch(error => {
  // Never log input, request headers, response bodies, or tokens.
  process.stderr.write(error instanceof SyntaxError ? 'Invalid JSON input\n' : error.message + '\n')
  process.exitCode = 1
})

module.exports = { collectAssets, hashAsset, uploadAssets }
