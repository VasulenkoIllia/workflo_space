import puppeteer from 'puppeteer-core'

/**
 * Thrown when Chromium can't be launched (no executable path, or the binary is missing — e.g.
 * local dev / CI without the browser). The caller catches this to fall back to serving raw HTML
 * instead of failing the request. A real render bug surfaces as a different error.
 */
export class ChromiumUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChromiumUnavailableError'
  }
}

/**
 * HTML → A4 PDF via system Chromium (puppeteer-core, no bundled binary). In production the Docker
 * image installs `chromium` and sets `PUPPETEER_EXECUTABLE_PATH`; elsewhere this throws
 * ChromiumUnavailableError and the caller serves the HTML.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
  if (!executablePath) {
    throw new ChromiumUnavailableError('PUPPETEER_EXECUTABLE_PATH is not set — no system Chromium')
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
  } catch (err) {
    throw new ChromiumUnavailableError(
      `Chromium launch failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
