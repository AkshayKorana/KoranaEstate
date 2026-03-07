import { spawn } from 'node:child_process'

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

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
  console.log('[backend] Generating Prisma client from backend schema...')
  await run(npmCmd, ['--prefix', 'apps/backend', 'run', 'prisma:generate'])

  console.log('[backend] Starting Nest dev server...')
  await run(npmCmd, ['--prefix', 'apps/backend', 'run', 'dev'])
}

main().catch((error) => {
  console.error('[backend] Startup failed:', error.message)
  process.exit(1)
})
