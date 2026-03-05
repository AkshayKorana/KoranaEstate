import { Injectable, Logger } from '@nestjs/common'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { PricesIngestService, type ScraperOutput } from '../prices/prices-ingest.service'
import { PricesService } from '../prices/prices.service'

type ScriptRunResult = {
  payload: ScraperOutput
  stderr: string
  stdout: string
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name)

  constructor(
    private readonly pricesService: PricesService,
    private readonly pricesIngestService: PricesIngestService,
  ) {}

  private getConfig() {
    const pythonBin = process.env.PRICES_PYTHON_BIN || 'python3'
    const configuredPath = process.env.PRICES_SCRAPER_SCRIPT
    const candidatePaths = [
      configuredPath,
      join(process.cwd(), 'python', 'prices_scraper', 'scraper.py'),
      join(process.cwd(), 'korana-estate', 'backend', 'python', 'prices_scraper', 'scraper.py'),
    ].filter((value): value is string => Boolean(value))
    const scriptPath = candidatePaths.find((path) => existsSync(path)) || candidatePaths[0]
    const timeoutMs = Number(process.env.PRICES_SCRAPER_TIMEOUT_MS || 120000)
    const retries = Number(process.env.PRICES_SCRAPER_RETRIES || 2)
    const enabled = (process.env.PRICES_SCRAPER_ENABLED || 'true').toLowerCase() !== 'false'

    return {
      pythonBin,
      scriptPath,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 1000 ? timeoutMs : 120000,
      retries: Number.isFinite(retries) && retries >= 0 ? retries : 2,
      enabled,
    }
  }

  private async runPythonScript(input: unknown, timeoutMs: number): Promise<ScriptRunResult> {
    const config = this.getConfig()

    return new Promise((resolve, reject) => {
      const child = spawn(config.pythonBin, [config.scriptPath, '--input', '-'], {
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      let timedOut = false

      const timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
      }, timeoutMs)

      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk) => { stdout += chunk })
      child.stderr.on('data', (chunk) => { stderr += chunk })

      child.on('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })

      child.on('close', (code) => {
        clearTimeout(timer)

        if (timedOut) {
          reject(new Error(`Python scraper timed out after ${timeoutMs}ms.`))
          return
        }

        if (code !== 0) {
          reject(new Error(`Python scraper exited with code ${code}. stderr: ${stderr.slice(-1000)}`))
          return
        }

        let payload: ScraperOutput
        try {
          payload = JSON.parse(stdout) as ScraperOutput
        } catch (error) {
          reject(new Error(`Failed to parse scraper JSON output: ${error instanceof Error ? error.message : String(error)}. stdout: ${stdout.slice(-1000)}`))
          return
        }

        resolve({ payload, stderr, stdout })
      })

      child.stdin.write(JSON.stringify(input))
      child.stdin.end()
    })
  }

  async runPriceScraper(dryRun = false) {
    const config = this.getConfig()
    const startedAt = new Date()

    if (!config.enabled) {
      return {
        ok: false,
        skipped: true,
        reason: 'PRICES_SCRAPER_ENABLED is false',
        startedAt: startedAt.toISOString(),
      }
    }

    if (!config.scriptPath || !config.scriptPath.endsWith('.py')) {
      return {
        ok: false,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        error: 'PRICES_SCRAPER_SCRIPT is not configured correctly.',
      }
    }
    if (!config.scriptPath || !existsSync(config.scriptPath)) {
      return {
        ok: false,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        error: `Scraper script not found at ${config.scriptPath}.`,
      }
    }

    const products = await this.pricesService.getEnabledProducts()
    const scriptInput = {
      runAt: startedAt.toISOString(),
      products: products.map((product) => ({
        productKey: product.productKey,
        displayName: product.displayName,
        unit: product.unit,
        source: product.defaultSource || 'Python Playwright Scraper',
        sourceUrl: product.sourceUrl || '',
      })),
    }

    let lastError: Error | null = null
    let execution: ScriptRunResult | null = null

    for (let attempt = 0; attempt <= config.retries; attempt += 1) {
      try {
        this.logger.log(`Running python scraper (attempt ${attempt + 1}/${config.retries + 1}) using ${config.scriptPath}`)
        execution = await this.runPythonScript(scriptInput, config.timeoutMs)
        break
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        lastError = err
        this.logger.error(`Scraper attempt ${attempt + 1} failed: ${err.message}`)

        if (attempt < config.retries) {
          const delayMs = 1000 * (2 ** attempt)
          await sleep(delayMs)
        }
      }
    }

    if (!execution) {
      return {
        ok: false,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        error: lastError?.message || 'Unknown scraper execution failure.',
      }
    }

    const ingest = await this.pricesIngestService.ingestScraperOutput(
      execution.payload,
      'python-playwright',
      dryRun,
    )

    return {
      ok: true,
      mode: dryRun ? 'dry-run' : 'ingest',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      scraper: {
        observations: execution.payload.observations?.length || 0,
        errors: execution.payload.errors?.length || 0,
        runAt: execution.payload.runAt,
      },
      ingest,
      logs: {
        stderr: execution.stderr.slice(-2000),
      },
    }
  }
}
