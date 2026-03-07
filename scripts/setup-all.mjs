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
  console.log('[setup] Installing root dependencies...')
  await run(npmCmd, ['install'])

  console.log('[setup] Installing web dependencies...')
  await run(npmCmd, ['--prefix', 'apps/web', 'install'])

  console.log('[setup] Installing backend dependencies...')
  await run(npmCmd, ['--prefix', 'apps/backend', 'install'])

  console.log('[setup] Generating backend Prisma client...')
  await run(npmCmd, ['--prefix', 'apps/backend', 'run', 'prisma:generate'])

  console.log('[setup] Complete. Run `npm run dev:web` and/or `npm run dev:backend`.')
}

main().catch((error) => {
  console.error('[setup] Failed:', error.message)
  process.exit(1)
})
