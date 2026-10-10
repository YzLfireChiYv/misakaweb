/**
 * Local release preparation: typecheck, test, feedback build, then write a
 * public development-channel manifest. Does not git or network-publish.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const REPO_RELATIVE_ARTIFACT = 'products/experience/misakaweb-feedback-test.user.js'
const ARTIFACT_PATH = path.resolve(ROOT, '..', 'misakaweb-feedback-test.user.js')
const MANIFEST_PATH = path.resolve(ROOT, '..', 'release-manifest.json')
const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/release.json'), 'utf8'))
const EXPECTED_VERSION = release.development.version
const CHANNEL = 'development'
const SCHEMA_VERSION = 1

const isWindows = process.platform === 'win32'

const pnpmCommand = () => (isWindows ? 'pnpm.cmd' : 'pnpm')

const runPnpm = (args) => {
    const result = spawnSync(pnpmCommand(), args, {
        cwd: ROOT,
        stdio: 'inherit',
        env: process.env,
        shell: isWindows,
        windowsHide: true,
    })
    if (result.error) {
        console.error(result.error)
        process.exit(1)
    }
    const code = result.status
    if (code !== 0) {
        process.exit(code ?? 1)
    }
}

const readHeaderValue = (header, name) => {
    const match = header.match(new RegExp(`^// @${name}\\s+(\\S+)\\s*$`, 'm'))
    return match ? match[1] : ''
}

const writeManifest = () => {
    if (!fs.existsSync(ARTIFACT_PATH)) {
        console.error(`missing artifact ${REPO_RELATIVE_ARTIFACT}`)
        process.exit(1)
    }
    const bytesBuf = fs.readFileSync(ARTIFACT_PATH)
    const headerMatch = bytesBuf.toString('utf8').match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/)
    if (!headerMatch) {
        console.error('artifact missing userscript metadata')
        process.exit(1)
    }
    const header = headerMatch[0]
    const version = readHeaderValue(header, 'version')
    const updateURL = readHeaderValue(header, 'updateURL')
    const downloadURL = readHeaderValue(header, 'downloadURL')
    if (version !== EXPECTED_VERSION) {
        console.error(`expected version ${EXPECTED_VERSION}, got ${version || '(empty)'}`)
        process.exit(1)
    }
    if (updateURL !== release.development.url || downloadURL !== release.development.url) {
        console.error('artifact metadata must use the configured development channel URL')
        process.exit(1)
    }
    const manifest = {
        schemaVersion: SCHEMA_VERSION,
        version,
        channel: CHANNEL,
        artifact: REPO_RELATIVE_ARTIFACT,
        updateURL,
        downloadURL,
        sha256: createHash('sha256').update(bytesBuf).digest('hex'),
        bytes: bytesBuf.length,
    }
    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 4)}\n`)
    console.log('wrote', 'products/experience/release-manifest.json')
}

runPnpm(['run', 'maintenance:index'])
runPnpm(['exec', 'vue-tsc', '-b'])
runPnpm(['run', 'test'])
runPnpm(['run', 'build:feedback'])
// Current default release updates the full test channel only. Ordinary editions
// are built deliberately when needed, not as a mandatory release matrix.
writeManifest()
