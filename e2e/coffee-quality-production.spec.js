import { test } from '@playwright/test'
import { runCoffeeAcceptance } from './coffeeScenario.js'

test('coffee acceptance: production costing and quality release control finished stock', async ({ page }, testInfo) => {
  await runCoffeeAcceptance(page, testInfo, 'quality-production')
})
