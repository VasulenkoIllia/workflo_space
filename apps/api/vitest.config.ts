import { defineConfig } from 'vitest/config'

/**
 * CI-раннер (7GB) вибивало OOM (SIGABRT/134, mass worker deaths) на повному
 * api-сьюті ~1070 тестів: дефолтний maxThreads = nCPU тримає кілька важких
 * воркерів (prisma-моки + TS-трансформи) одночасно. У CI тиснемо паралелізм
 * до 2 воркерів; локально лишаємо дефолт — швидкість важливіша.
 */
export default defineConfig({
  test: process.env.CI
    ? { poolOptions: { threads: { maxThreads: 2, minThreads: 1 } } }
    : {},
})
