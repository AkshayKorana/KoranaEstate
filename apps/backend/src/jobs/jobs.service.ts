import { Injectable, Logger } from '@nestjs/common'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { PricesIngestService, type ScraperOutput } from '../prices/prices-ingest.service'
import { PricesService } from '../prices/prices.service'

type ScriptRunResult = {
  ok: true
  attempt: number
  payload: ScraperOutput
  stderr: string
  stdout: string
  durationMs: number
}

type ScriptRunFailure = {
  ok: false
  attempt: number
  durationMs: number
  timedOut: boolean
  exitCode: number | null
  signal: NodeJS.Signals | null
  error: string
  stdoutTail: string
  stderrTail: string
}

type JobsConfig = {
  runnerPath: string
  scraperEntry: string
  timeoutMs: number
  killGraceMs: number
  maxTotalDurationMs: number
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
      join(process.cwd(), 'services', 'price-collector', 'run.sh'),
      join(process.cwd(), 'scripts', 'playwright_prices', 'run.sh'),
      join(process.cwd(), 'apps', 'backend', 'scripts', 'playwright_prices', 'run.sh'),
      join(process.cwd(), 'backend', 'scripts', 'playwright_prices', 'run.sh'),
      join(process.cwd(), '..', '..', 'services', 'price-collector', 'run.sh'),
      join(process.cwd(), '..', '..', 'scripts', 'playwright_prices', 'run.sh'),
    ].filter((value): value is string => Boolean(value))
    const runnerPath = candidatePaths.find((path) => existsSync(path)) || candidatePaths[0]
    const scraperEntry = process.env.PRICES_SCRAPER_ENTRY || 'scrape_prices.py'
    const timeoutMs = Number(process.env.PRICES_SCRAPER_TIMEOUT_MS || 120000)
    const killGraceMs = Number(process.env.PRICES_SCRAPER_KILL_GRACE_MS || 5000)
    const maxTotalDurationMs = Number(process.env.PRICES_SCRAPER_MAX_TOTAL_DURATION_MS || 300000)
    const retries = Number(process.env.PRICES_SCRAPER_RETRIES || 2)
    const enabled = (process.env.PRICES_SCRAPER_ENABLED || 'true').toLowerCase() !== 'false'

    return {
      runnerPath,
      scraperEntry,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 1000 ? timeoutMs : 120000,
      killGraceMs: Number.isFinite(killGraceMs) && killGraceMs >= 1000 ? killGraceMs : 5000,
      maxTotalDurationMs: Number.isFinite(maxTotalDurationMs) && maxTotalDurationMs > 1000 ? maxTotalDurationMs : 300000,
      retries: Number.isFinite(retries) && retries >= 0 ? retries : 2,
      enabled,
    }
  }

  private tail(text: string, maxChars = 2000) {
    return text.length > maxChars ? text.slice(-maxChars) : text
  }

  private terminateProcessGroup(pid: number | undefined, signal: NodeJS.Signals) {
    if (!pid) {
      return
    }

    try {
      process.kill(-pid, signal)
      return
    } catch {
      try {
        process.kill(pid, signal)
      } catch {
        return
      }
    }
  }

  private async runPythonScript(
    config: JobsConfig,
    attempt: number,
    timeoutMs: number,
  ): Promise<ScriptRunResult | ScriptRunFailure> {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now()
      const child = spawn('bash', [config.runnerPath, config.scraperEntry], {
        env: {
          ...process.env,
          PRICES_SCRAPER_ENTRY: config.scraperEntry,
        },
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      let timedOut = false
      let settled = false
      let forceKillTimer: NodeJS.Timeout | null = null

      const settle = (result: ScriptRunResult | ScriptRunFailure) => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        if (forceKillTimer) {
          clearTimeout(forceKillTimer)
        }
        resolve(result)
      }

      const timer = setTimeout(() => {
        timedOut = true
        this.logger.warn(
          `Scraper attempt ${attempt} exceeded timeout ${timeoutMs}ms. Sending SIGTERM to pid=${child.pid ?? 'unknown'}.`,
        )
        this.terminateProcessGroup(child.pid, 'SIGTERM')

        forceKillTimer = setTimeout(() => {
          this.logger.warn(
            `Scraper attempt ${attempt} did not exit within kill grace ${config.killGraceMs}ms. Sending SIGKILL to pid=${child.pid ?? 'unknown'}.`,
          )
          this.terminateProcessGroup(child.pid, 'SIGKILL')
        }, config.killGraceMs)
      }, timeoutMs)

      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk) => { stdout += chunk })
      child.stderr.on('data', (chunk) => { stderr += chunk })

      child.on('error', (error) => {
        const durationMs = Date.now() - startedAt
        reject({
          ok: false,
          attempt,
          durationMs,
          timedOut,
          exitCode: null,
          signal: null,
          error: `Failed to start scraper process: ${error.message}`,
          stdoutTail: this.tail(stdout),
          stderrTail: this.tail(stderr),
        } satisfies ScriptRunFailure)
      })

      child.on('close', (code, signal) => {
        const durationMs = Date.now() - startedAt
        if (timedOut) {
          settle({
            ok: false,
            attempt,
            durationMs,
            timedOut: true,
            exitCode: code,
            signal,
            error: `Python scraper timed out after ${timeoutMs}ms.`,
            stdoutTail: this.tail(stdout),
            stderrTail: this.tail(stderr),
          })
          return
        }

        if (code !== 0) {
          settle({
            ok: false,
            attempt,
            durationMs,
            timedOut: false,
            exitCode: code,
            signal,
            error: `Python scraper exited with code ${code}${signal ? ` signal ${signal}` : ''}.`,
            stdoutTail: this.tail(stdout),
            stderrTail: this.tail(stderr),
          })
          return
        }

        let payload: ScraperOutput
        try {
          payload = JSON.parse(stdout) as ScraperOutput
        } catch (error) {
          settle({
            ok: false,
            attempt,
            durationMs,
            timedOut: false,
            exitCode: code,
            signal,
            error: `Failed to parse scraper JSON output: ${error instanceof Error ? error.message : String(error)}.`,
            stdoutTail: this.tail(stdout),
            stderrTail: this.tail(stderr),
          })
          return
        }

        settle({
          ok: true,
          attempt,
          payload,
          stderr,
          stdout,
          durationMs,
        })
      })
    })
  }

  async runPriceScraper(dryRun = false) {
    const config = this.getConfig()
    const startedAt = new Date()
    const deadlineAt = startedAt.getTime() + config.maxTotalDurationMs

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

    let lastError: ScriptRunFailure | null = null
    let execution: ScriptRunResult | null = null

    for (let attempt = 0; attempt <= config.retries; attempt += 1) {
      const attemptNumber = attempt + 1
      const remainingMs = deadlineAt - Date.now()
      if (remainingMs <= 0) {
        lastError = {
          ok: false,
          attempt: attemptNumber,
          durationMs: Date.now() - startedAt.getTime(),
          timedOut: true,
          exitCode: null,
          signal: null,
          error: `Price scraper exceeded max total duration of ${config.maxTotalDurationMs}ms before attempt ${attemptNumber}.`,
          stdoutTail: '',
          stderrTail: '',
        }
        break
      }

      const attemptTimeoutMs = Math.min(config.timeoutMs, remainingMs)
      try {
        this.logger.log(
          `Running python scraper (attempt ${attemptNumber}/${config.retries + 1}) using ${config.runnerPath} entry=${config.scraperEntry} timeout=${attemptTimeoutMs}ms maxTotal=${config.maxTotalDurationMs}ms`,
        )
        const result = await this.runPythonScript(config, attemptNumber, attemptTimeoutMs)
        if (result.ok) {
          execution = result
          this.logger.log(
            `Scraper attempt ${attemptNumber} succeeded in ${result.durationMs}ms with ${result.payload.items?.length ?? 0} items.`,
          )
          break
        }

        lastError = result
        this.logger.error(
          `Scraper attempt ${attemptNumber} failed after ${result.durationMs}ms timeout=${result.timedOut} exitCode=${result.exitCode ?? 'null'} signal=${result.signal ?? 'null'} stderrTail=${JSON.stringify(result.stderrTail)}`,
        )
      } catch (error) {
        const err = error as ScriptRunFailure
        lastError = err
        this.logger.error(
          `Scraper attempt ${attemptNumber} failed before completion: ${err.error} stderrTail=${JSON.stringify(err.stderrTail)}`,
        )
      }

      if (attempt < config.retries) {
        const delayMs = Math.min(1000 * (2 ** attempt), Math.max(deadlineAt - Date.now(), 0))
        if (delayMs > 0) {
          await sleep(delayMs)
        }
      }
    }

    if (!execution) {
      this.logger.error(
        `Price scraper failed after ${config.retries + 1} attempt(s). finalError=${lastError?.error ?? 'Unknown scraper execution failure.'}`,
      )
      return {
        ok: false,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        error: lastError?.error || 'Unknown scraper execution failure.',
        scraper: {
          attempt: lastError?.attempt ?? config.retries + 1,
          retries: config.retries,
          timeoutMs: config.timeoutMs,
          maxTotalDurationMs: config.maxTotalDurationMs,
          timedOut: lastError?.timedOut ?? false,
          exitCode: lastError?.exitCode ?? null,
          signal: lastError?.signal ?? null,
          durationMs: lastError?.durationMs ?? 0,
        },
        logs: {
          stdout: lastError?.stdoutTail ?? '',
          stderr: lastError?.stderrTail ?? '',
        },
      }
    }

    try {
      const ingest = await this.pricesIngestService.ingestScraperOutput(
        execution.payload,
        'python-playwright',
        dryRun,
      )

      this.logger.log(
        `Price scraper job completed successfully in ${Date.now() - startedAt.getTime()}ms mode=${dryRun ? 'dry-run' : 'ingest'}.`,
      )

      return {
        ok: true,
        mode: dryRun ? 'dry-run' : 'ingest',
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        scraper: {
          attempt: execution.attempt,
          retries: config.retries,
          timeoutMs: config.timeoutMs,
          maxTotalDurationMs: config.maxTotalDurationMs,
          durationMs: execution.durationMs,
          observations: execution.payload.items?.filter((item) => Number.isFinite(item.value)).length || 0,
          errors: execution.payload.items?.filter((item) => !Number.isFinite(item.value)).length || 0,
          runAt: execution.payload.fetchedAt,
        },
        ingest,
        logs: {
          stdout: this.tail(execution.stdout),
          stderr: this.tail(execution.stderr),
        },
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.logger.error(`Price scraper ingest failed after scraper success: ${err.message}`, err.stack)

      return {
        ok: false,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        error: `Scraper completed but ingest failed: ${err.message}`,
        scraper: {
          attempt: execution.attempt,
          retries: config.retries,
          timeoutMs: config.timeoutMs,
          maxTotalDurationMs: config.maxTotalDurationMs,
          durationMs: execution.durationMs,
          observations: execution.payload.items?.filter((item) => Number.isFinite(item.value)).length || 0,
          errors: execution.payload.items?.filter((item) => !Number.isFinite(item.value)).length || 0,
          runAt: execution.payload.fetchedAt,
        },
        logs: {
          stdout: this.tail(execution.stdout),
          stderr: this.tail(execution.stderr),
        },
      }
    }
  }
}
