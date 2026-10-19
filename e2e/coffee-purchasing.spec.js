import { test } from '@playwright/test'
import { runCoffeeAcceptance } from './coffeeScenario.js'

test('coffee acceptance: shortages, purchase approval, receipt, production, quality, and sale', async ({ page }, testInfo) => {
  await runCoffeeAcceptance(page, testInfo, 'purchasing')
})
