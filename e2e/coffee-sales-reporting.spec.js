import { test } from '@playwright/test'
import { runCoffeeAcceptance } from './coffeeScenario.js'

test('coffee acceptance: POS COGS, profit, dashboard, reports, and authenticated UI', async ({ page }, testInfo) => {
  await runCoffeeAcceptance(page, testInfo, 'sales-reporting')
})
