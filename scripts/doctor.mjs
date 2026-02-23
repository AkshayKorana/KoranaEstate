import { readFileSync, existsSync } from 'node:fs'

const [nodeMajor] = process.versions.node.split('.').map(Number)
const npmVersion = process.env.npm_config_user_agent?.match(/npm\/(\d+)\.(\d+)\./)
const npmMajor = npmVersion ? Number(npmVersion[1]) : null

let ok = true

if (nodeMajor !== 20) {
  ok = false
  console.error(`[doctor] Node version mismatch: found ${process.versions.node}, expected Node 20.x`)
} else {
  console.log(`[doctor] Node version OK: ${process.versions.node}`)
}

if (npmMajor !== null && npmMajor !== 10) {
  ok = false
  console.error(`[doctor] npm version mismatch: expected npm 10.x, found major ${npmMajor}`)
} else if (npmMajor !== null) {
  console.log('[doctor] npm version OK')
} else {
  console.log('[doctor] npm version not detected from user agent')
}

const hasDatabaseUrlInEnv = Boolean(process.env.DATABASE_URL)
const hasDotEnv = existsSync('.env')
const hasDatabaseUrlInDotEnv =
  hasDotEnv && /(^|\n)\s*DATABASE_URL\s*=/.test(readFileSync('.env', 'utf8'))

if (!hasDatabaseUrlInEnv && !hasDatabaseUrlInDotEnv) {
  ok = false
  console.error('[doctor] DATABASE_URL not found in environment or .env')
} else {
  console.log('[doctor] DATABASE_URL check OK')
}

if (!ok) process.exit(1)
