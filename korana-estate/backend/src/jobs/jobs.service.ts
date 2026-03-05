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

type JobsConfig = {
  runnerPath: string
  scraperEntry: string
  timeoutMs: number
  retries: number
  enabled: boolean
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name)

  constructor(
    private readonly pricesService: PricesService,
    private readonly pricesIngestService: PricesIngestService,
  ) {}

  private getConfig(): JobsConfig {
    const configuredPath = process.env.PRICES_SCRAPER_RUNNER

    const candidatePaths = [
      configuredPath,
      join(process.cwd(), 'scripts', 'playwright_prices', 'run.sh'),
      join(process.cwd(), 'korana-estate', 'backend', 'scripts', 'playwright_prices', 'run.sh'),
    ].filter((value): value is string => Boolean(value))
    const runnerPath = candidatePaths.find((path) => existsSync(path)) || candidatePaths[0]
    const scraperEntry = process.env.PRICES_SCRAPER_ENTRY || 'scrape_prices.py'
    const timeoutMs = Number(process.env.PRICES_SCRAPER_TIMEOUT_MS || 120000)
    const retries = Number(process.env.PRICES_SCRAPER_RETRIES || 2)
    const enabled = (process.env.PRICES_SCRAPER_ENABLED || 'true').toLowerCase() !== 'false'

    return {
      runnerPath,
      scraperEntry,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 1000 ? timeoutMs : 120000,
      retries: Number.isFinite(retries) && retries >= 0 ? retries : 2,
      enabled,
    }
  }

  private async runPythonScript(config: JobsConfig): Promise<ScriptRunResult> {
    return new Promise((resolve, reject) => {
      const child = spawn('bash', [config.runnerPath, config.scraperEntry], {
        env: {
          ...process.env,
          PRICES_SCRAPER_ENTRY: config.scraperEntry,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      let timedOut = false

      const timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
      }, config.timeoutMs)

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
          reject(new Error(`Python scraper timed out after ${config.timeoutMs}ms.`))
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

    if (!config.runnerPath || !config.runnerPath.endsWith('.sh')) {
      return {
        ok: false,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        error: 'PRICES_SCRAPER_RUNNER is not configured correctly.',
      }
    }
    if (!config.runnerPath || !existsSync(config.runnerPath)) {
      return {
        ok: false,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        error: `Scraper runner not found at ${config.runnerPath}.`,
      }
    }

    let lastError: Error | null = null
    let execution: ScriptRunResult | null = null

    for (let attempt = 0; attempt <= config.retries; attempt += 1) {
      try {
        this.logger.log(
          `Running python scraper (attempt ${attempt + 1}/${config.retries + 1}) using ${config.runnerPath} entry=${config.scraperEntry}`,
        )
        execution = await this.runPythonScript(config)
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
        observations: execution.payload.items?.filter((item) => Number.isFinite(item.value)).length || 0,
        errors: execution.payload.items?.filter((item) => !Number.isFinite(item.value)).length || 0,
        runAt: execution.payload.fetchedAt,
      },
      ingest,
      logs: {
        stderr: execution.stderr.slice(-2000),
      },
    }
  }
}
