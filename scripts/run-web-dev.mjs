import { spawn } from 'node:child_process'

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false, ...options })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} ${args.join(' ')} failed with exit code ${code}`))
    })
    child.on('error', reject)
  })
}

async function main() {
  console.log('[web] Generating Prisma client from prisma/schema.prisma...')
  await run(npxCmd, ['prisma', 'generate', '--schema', 'prisma/schema.prisma'])

  console.log('[web] Starting Next.js dev server...')
  await run(npmCmd, ['run', 'dev:raw'])
}

main().catch((error) => {
  console.error('[web] Startup failed:', error.message)
  process.exit(1)
})
