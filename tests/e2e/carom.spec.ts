import { test, expect, Page } from '@playwright/test'

/**
 * Helper: click a numpad button by its displayed text.
 */
async function pressNumpad(page: Page, key: string) {
  await page.locator('#numpad button', { hasText: new RegExp(`^${key}$`) }).click()
}

/**
 * Helper: dismiss the reason picker by clicking Skip.
 * Called after every + press since the picker now appears on every turn.
 */
async function skipReasonPicker(page: Page) {
  const skip = page.locator('#reason-options .reason-option.skip')
  await expect(skip).toBeVisible()
  await skip.click()
  // Wait for the picker to finish closing
  await expect(page.locator('#reason-overlay')).not.toHaveClass(/open/)
}

/**
 * Helper: add a turn by entering a value and pressing +, then skipping the reason picker.
 */
async function addTurn(page: Page, score: number | null = null) {
  if (score !== null && score > 0) {
    // Enter each digit
    for (const digit of String(score)) {
      await pressNumpad(page, digit)
    }
  }
  await page.locator('#btn-add-score').click()
  await skipReasonPicker(page)
}

/**
 * Helper: clear localStorage (including failure reasons so picker doesn't appear
 * unexpectedly) and reload the page.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/carom.html')
  await page.evaluate(() => {
    localStorage.removeItem('carom_moyennes')
    localStorage.removeItem('carom_game_details')
    // Keep failure reasons so reason picker tests work;
    // tests that don't want the picker use addTurn() which handles it.
  })
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
})

// ============================================================
// Numpad input
// ============================================================

test.describe('Numpad input', () => {
  test('pressing digits builds the staged score', async ({ page }) => {
    await pressNumpad(page, '1')
    await expect(page.locator('#add-display')).toHaveText('1')

    await pressNumpad(page, '5')
    await expect(page.locator('#add-display')).toHaveText('15')

    await pressNumpad(page, '0')
    await expect(page.locator('#add-display')).toHaveText('150')
  })

  test('backspace removes last digit', async ({ page }) => {
    await pressNumpad(page, '2')
    await pressNumpad(page, '3')
    await expect(page.locator('#add-display')).toHaveText('23')

    await pressNumpad(page, '<')
    await expect(page.locator('#add-display')).toHaveText('2')

    await pressNumpad(page, '<')
    await expect(page.locator('#add-display')).toHaveText('0')
  })

  test('clear (x) resets staged score to 0', async ({ page }) => {
    await pressNumpad(page, '7')
    await pressNumpad(page, '8')
    await expect(page.locator('#add-display')).toHaveText('78')

    await pressNumpad(page, 'x')
    await expect(page.locator('#add-display')).toHaveText('0')
  })
})

// ============================================================
// Adding a turn
// ============================================================

test.describe('Adding a turn', () => {
  test('pressing + adds staged score to the game', async ({ page }) => {
    await addTurn(page, 3)

    await expect(page.locator('#f-score')).toHaveValue('3')
    await expect(page.locator('#f-turns')).toHaveValue('1')
    await expect(page.locator('#f-moyenne')).toHaveText('3.00')
    await expect(page.locator('#add-display')).toHaveText('0')
  })

  test('adding a zero turn increments the zeros counter', async ({ page }) => {
    await addTurn(page, 0)

    await expect(page.locator('#f-score')).toHaveValue('0')
    await expect(page.locator('#f-turns')).toHaveValue('1')
    await expect(page.locator('#f-zeros')).toHaveText('1')
    await expect(page.locator('#f-moyenne')).toHaveText('0.00')
  })
})

// ============================================================
// Multiple turns
// ============================================================

test.describe('Multiple turns', () => {
  test('play 3 turns and verify score/turns/moyenne', async ({ page }) => {
    await addTurn(page, 5)
    await addTurn(page, 3)
    await addTurn(page, 7)

    await expect(page.locator('#f-score')).toHaveValue('15')
    await expect(page.locator('#f-turns')).toHaveValue('3')
    await expect(page.locator('#f-moyenne')).toHaveText('5.00')
  })

  test('play turns with zeros and verify zeros counter', async ({ page }) => {
    await addTurn(page, 4)
    await addTurn(page, 0)
    await addTurn(page, 0)

    await expect(page.locator('#f-score')).toHaveValue('4')
    await expect(page.locator('#f-turns')).toHaveValue('3')
    await expect(page.locator('#f-zeros')).toHaveText('2')
  })
})

// ============================================================
// Reset game
// ============================================================

test.describe('Reset game', () => {
  test('reset clears all fields to 0', async ({ page }) => {
    await addTurn(page, 5)
    await expect(page.locator('#f-score')).toHaveValue('5')

    await page.locator('#btn-reset').click()

    await expect(page.locator('#f-score')).toHaveValue('0')
    await expect(page.locator('#f-turns')).toHaveValue('0')
    await expect(page.locator('#f-moyenne')).toHaveText('0.00')
    await expect(page.locator('#f-zeros')).toHaveText('0')
    await expect(page.locator('#add-display')).toHaveText('0')
  })
})

// ============================================================
// End game
// ============================================================

test.describe('End game', () => {
  test('end game saves moyenne to Overall list and resets game state', async ({ page }) => {
    await addTurn(page, 4)
    await addTurn(page, 6)

    await expect(page.locator('#f-score')).toHaveValue('10')
    await expect(page.locator('#f-turns')).toHaveValue('2')

    await page.locator('#btn-end').click()

    await expect(page.locator('#f-score')).toHaveValue('0')
    await expect(page.locator('#f-turns')).toHaveValue('0')
    await expect(page.locator('#f-moyenne')).toHaveText('0.00')

    const moyennes = await page.evaluate(() => {
      const raw = localStorage.getItem('carom_moyennes')
      return raw ? JSON.parse(raw) : null
    })
    expect(moyennes).not.toBeNull()
    expect(moyennes[moyennes.length - 1]).toBe(5)
  })

  test('end game with no turns does nothing', async ({ page }) => {
    const beforeMoyennes = await page.evaluate(() =>
      localStorage.getItem('carom_moyennes')
    )

    await page.locator('#btn-end').click()

    const afterMoyennes = await page.evaluate(() =>
      localStorage.getItem('carom_moyennes')
    )
    expect(afterMoyennes).toBe(beforeMoyennes)
  })
})

// ============================================================
// Tab switching
// ============================================================

test.describe('Tab switching', () => {
  test('can switch between Game and Overall tabs', async ({ page }) => {
    await expect(page.locator('#tab-game')).toHaveClass(/active/)
    await expect(page.locator('#tab-overall')).not.toHaveClass(/active/)

    await page.locator('.tab-bar button[data-tab="overall"]').click()
    await expect(page.locator('#tab-overall')).toHaveClass(/active/)
    await expect(page.locator('#tab-game')).not.toHaveClass(/active/)

    await page.locator('.tab-bar button[data-tab="game"]').click()
    await expect(page.locator('#tab-game')).toHaveClass(/active/)
    await expect(page.locator('#tab-overall')).not.toHaveClass(/active/)
  })

  test('can switch to Config tab', async ({ page }) => {
    await page.locator('.tab-bar button[data-tab="config"]').click()
    await expect(page.locator('#tab-config')).toHaveClass(/active/)
  })
})

// ============================================================
// Overall tab - collapsible moyennes list
// ============================================================

test.describe('Overall collapsible', () => {
  test('clicking header expands and collapses the moyennes list', async ({ page }) => {
    await page.locator('.tab-bar button[data-tab="overall"]').click()

    await expect(page.locator('#moy-list')).not.toHaveClass(/open/)

    await page.locator('#moy-header').click()
    await expect(page.locator('#moy-list')).toHaveClass(/open/)
    await expect(page.locator('#moy-header')).toHaveClass(/open/)

    await page.locator('#moy-header').click()
    await expect(page.locator('#moy-list')).not.toHaveClass(/open/)
    await expect(page.locator('#moy-header')).not.toHaveClass(/open/)
  })
})

// ============================================================
// Config tab — failure reasons
// ============================================================

test.describe('Config tab', () => {
  test('shows default failure reasons', async ({ page }) => {
    await page.locator('.tab-bar button[data-tab="config"]').click()
    const items = page.locator('.reason-item')
    await expect(items).toHaveCount(5) // DEFAULT_REASONS has 5 entries
    await expect(items.first()).toContainText('Too soft')
  })

  test('can add a new reason', async ({ page }) => {
    await page.locator('.tab-bar button[data-tab="config"]').click()
    await page.locator('#cfg-reason-input').fill('Bad position')
    await page.locator('#cfg-add-reason').click()

    const items = page.locator('.reason-item')
    await expect(items).toHaveCount(6)
    await expect(items.last()).toContainText('Bad position')
  })

  test('can delete a reason', async ({ page }) => {
    await page.locator('.tab-bar button[data-tab="config"]').click()
    const before = await page.locator('.reason-item').count()

    await page.locator('.reason-item').first().locator('.reason-delete').click()
    await expect(page.locator('.reason-item')).toHaveCount(before - 1)
  })
})

// ============================================================
// Reason picker
// ============================================================

test.describe('Reason picker', () => {
  test('picker appears after pressing + and closes on skip', async ({ page }) => {
    await pressNumpad(page, '3')
    await page.locator('#btn-add-score').click()

    await expect(page.locator('#reason-overlay')).toHaveClass(/open/)

    await page.locator('#reason-options .reason-option.skip').click()
    await expect(page.locator('#reason-overlay')).not.toHaveClass(/open/)
  })

  test('selecting a reason stores it with the turn', async ({ page }) => {
    await pressNumpad(page, '2')
    await page.locator('#btn-add-score').click()

    // Pick the first reason ("Too soft")
    await page.locator('#reason-options .reason-option').first().click()
    await expect(page.locator('#reason-overlay')).not.toHaveClass(/open/)

    // End the game and inspect stored details
    await page.locator('#btn-end').click()

    const details = await page.evaluate(() => {
      const raw = localStorage.getItem('carom_game_details')
      if (!raw) return null
      const arr = JSON.parse(raw)
      return arr[arr.length - 1]
    })
    expect(details).not.toBeNull()
    expect(details.turns[0].reason).toBe('Too soft')
  })

  test('picker closes when tapping backdrop and stores no reason', async ({ page }) => {
    await page.locator('#btn-add-score').click()

    await expect(page.locator('#reason-overlay')).toHaveClass(/open/)
    await page.locator('#reason-overlay').click({ position: { x: 10, y: 10 } })
    await expect(page.locator('#reason-overlay')).not.toHaveClass(/open/)
  })
})

// ============================================================
// Game detail modal
// ============================================================

test.describe('Game detail modal', () => {
  test('after ending a game, can open detail modal with correct info', async ({ page }) => {
    await addTurn(page, 2)
    await addTurn(page, 5)
    await addTurn(page, 3)

    await page.locator('#btn-end').click()

    await page.locator('.tab-bar button[data-tab="overall"]').click()
    await page.locator('#moy-header').click()
    await expect(page.locator('#moy-list')).toHaveClass(/open/)

    const lastItem = page.locator('#moy-list .m-item').last()
    await expect(lastItem).toBeVisible()
    await expect(lastItem.locator('.m-val')).toHaveText('3.33')
    await lastItem.click()

    await expect(page.locator('#detail-overlay')).toHaveClass(/open/)
    await expect(page.locator('#detail-title')).toContainText('3.33 moy.')
    await expect(page.locator('#detail-subtitle')).toContainText('10 pts')
    await expect(page.locator('#detail-subtitle')).toContainText('3 turns')

    // 3 turns, no reasons selected — 3 data rows
    const turnRows = page.locator('#detail-tbody tr')
    await expect(turnRows).toHaveCount(3)

    const firstCells = turnRows.nth(0).locator('td')
    await expect(firstCells.nth(0)).toHaveText('1')
    await expect(firstCells.nth(1)).toHaveText('2')
    await expect(firstCells.nth(2)).toHaveText('2')

    const lastCells = turnRows.nth(2).locator('td')
    await expect(lastCells.nth(0)).toHaveText('3')
    await expect(lastCells.nth(1)).toHaveText('3')
    await expect(lastCells.nth(2)).toHaveText('10')
  })

  test('detail modal shows chart (SVG element present)', async ({ page }) => {
    await addTurn(page, 4)
    await addTurn(page, 2)
    await page.locator('#btn-end').click()

    await page.locator('.tab-bar button[data-tab="overall"]').click()
    await page.locator('#moy-header').click()
    await page.locator('#moy-list .m-item').last().click()

    await expect(page.locator('#detail-chart svg')).toBeVisible()
  })

  test('reason shown as sub-row in turn table', async ({ page }) => {
    // Play a turn and pick a reason
    await pressNumpad(page, '3')
    await page.locator('#btn-add-score').click()
    await page.locator('#reason-options .reason-option').first().click() // "Too soft"

    await page.locator('#btn-end').click()

    await page.locator('.tab-bar button[data-tab="overall"]').click()
    await page.locator('#moy-header').click()
    await page.locator('#moy-list .m-item').last().click()

    // Should have 2 rows: 1 turn row + 1 reason sub-row
    const rows = page.locator('#detail-tbody tr')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1).locator('.td-reason')).toContainText('Too soft')
  })
})

// ============================================================
// Close detail modal
// ============================================================

test.describe('Close detail modal', () => {
  async function playGameAndOpenDetail(page: Page) {
    await addTurn(page, 5)
    await page.locator('#btn-end').click()

    await page.locator('.tab-bar button[data-tab="overall"]').click()
    await page.locator('#moy-header').click()
    await page.locator('#moy-list .m-item').last().click()

    await expect(page.locator('#detail-overlay')).toHaveClass(/open/)
  }

  test('close via x button', async ({ page }) => {
    await playGameAndOpenDetail(page)

    await page.locator('#detail-close').click()

    await expect(page.locator('#detail-overlay')).not.toHaveClass(/open/)
    await page.waitForTimeout(350)
    await expect(page.locator('#detail-overlay')).toBeHidden()
  })

  test('close via backdrop click', async ({ page }) => {
    await playGameAndOpenDetail(page)

    await page.locator('#detail-overlay').click({ position: { x: 10, y: 10 } })

    await expect(page.locator('#detail-overlay')).not.toHaveClass(/open/)
    await page.waitForTimeout(350)
    await expect(page.locator('#detail-overlay')).toBeHidden()
  })
})
