import { test, expect, Page } from '@playwright/test'

/**
 * Helper: click a numpad button by its displayed text.
 * The numpad buttons are children of #numpad.
 */
async function pressNumpad(page: Page, key: string) {
  await page.locator('#numpad button', { hasText: new RegExp(`^${key}$`) }).click()
}

/**
 * Helper: clear localStorage before each test so tests are isolated.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/carom.html')
  await page.evaluate(() => {
    localStorage.removeItem('carom_moyennes')
    localStorage.removeItem('carom_game_details')
  })
  // Reload so the app re-reads empty localStorage
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
    // Stage score of 3
    await pressNumpad(page, '3')
    await page.locator('#btn-add-score').click()

    // Score should be 3, turns should be 1
    await expect(page.locator('#f-score')).toHaveValue('3')
    await expect(page.locator('#f-turns')).toHaveValue('1')

    // Moyenne = 3/1 = 3.00
    await expect(page.locator('#f-moyenne')).toHaveText('3.00')

    // Add display should reset to 0
    await expect(page.locator('#add-display')).toHaveText('0')
  })

  test('adding a zero turn increments the zeros counter', async ({ page }) => {
    // Stage 0 (default) and press +
    await page.locator('#btn-add-score').click()

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
    // Turn 1: score 5
    await pressNumpad(page, '5')
    await page.locator('#btn-add-score').click()

    // Turn 2: score 3
    await pressNumpad(page, '3')
    await page.locator('#btn-add-score').click()

    // Turn 3: score 7
    await pressNumpad(page, '7')
    await page.locator('#btn-add-score').click()

    // Total score = 5 + 3 + 7 = 15, turns = 3
    await expect(page.locator('#f-score')).toHaveValue('15')
    await expect(page.locator('#f-turns')).toHaveValue('3')

    // Moyenne = 15/3 = 5.00
    await expect(page.locator('#f-moyenne')).toHaveText('5.00')
  })

  test('play turns with zeros and verify zeros counter', async ({ page }) => {
    // Turn 1: score 4
    await pressNumpad(page, '4')
    await page.locator('#btn-add-score').click()

    // Turn 2: score 0
    await page.locator('#btn-add-score').click()

    // Turn 3: score 0
    await page.locator('#btn-add-score').click()

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
    // Play a turn first
    await pressNumpad(page, '5')
    await page.locator('#btn-add-score').click()
    await expect(page.locator('#f-score')).toHaveValue('5')

    // Reset
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
    // Play 2 turns: 4 + 6 = 10, moyenne = 5.00
    await pressNumpad(page, '4')
    await page.locator('#btn-add-score').click()
    await pressNumpad(page, '6')
    await page.locator('#btn-add-score').click()

    await expect(page.locator('#f-score')).toHaveValue('10')
    await expect(page.locator('#f-turns')).toHaveValue('2')

    // End game
    await page.locator('#btn-end').click()

    // Game state should be reset
    await expect(page.locator('#f-score')).toHaveValue('0')
    await expect(page.locator('#f-turns')).toHaveValue('0')
    await expect(page.locator('#f-moyenne')).toHaveText('0.00')

    // Verify the moyenne was saved to localStorage
    const moyennes = await page.evaluate(() => {
      const raw = localStorage.getItem('carom_moyennes')
      return raw ? JSON.parse(raw) : null
    })
    expect(moyennes).not.toBeNull()
    // The last entry should be 5.00 (10 pts / 2 turns)
    expect(moyennes[moyennes.length - 1]).toBe(5)
  })

  test('end game with no turns does nothing', async ({ page }) => {
    // Get initial localStorage state
    const beforeMoyennes = await page.evaluate(() =>
      localStorage.getItem('carom_moyennes')
    )

    // End game without playing any turns
    await page.locator('#btn-end').click()

    // localStorage should not have changed
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
    // Game tab should be active by default
    await expect(page.locator('#tab-game')).toHaveClass(/active/)
    await expect(page.locator('#tab-overall')).not.toHaveClass(/active/)

    // Click Overall tab
    await page.locator('.tab-bar button[data-tab="overall"]').click()
    await expect(page.locator('#tab-overall')).toHaveClass(/active/)
    await expect(page.locator('#tab-game')).not.toHaveClass(/active/)

    // Click Game tab again
    await page.locator('.tab-bar button[data-tab="game"]').click()
    await expect(page.locator('#tab-game')).toHaveClass(/active/)
    await expect(page.locator('#tab-overall')).not.toHaveClass(/active/)
  })
})

// ============================================================
// Overall tab - collapsible moyennes list
// ============================================================

test.describe('Overall collapsible', () => {
  test('clicking header expands and collapses the moyennes list', async ({ page }) => {
    // Switch to Overall tab
    await page.locator('.tab-bar button[data-tab="overall"]').click()

    // List should be collapsed by default (no .open class)
    await expect(page.locator('#moy-list')).not.toHaveClass(/open/)

    // Click header to expand
    await page.locator('#moy-header').click()
    await expect(page.locator('#moy-list')).toHaveClass(/open/)
    await expect(page.locator('#moy-header')).toHaveClass(/open/)

    // Click header again to collapse
    await page.locator('#moy-header').click()
    await expect(page.locator('#moy-list')).not.toHaveClass(/open/)
    await expect(page.locator('#moy-header')).not.toHaveClass(/open/)
  })
})

// ============================================================
// Game detail modal
// ============================================================

test.describe('Game detail modal', () => {
  test('after ending a game, can open detail modal with correct info', async ({ page }) => {
    // Play a game: 3 turns with scores 2, 5, 3 = total 10, moyenne ~3.33
    await pressNumpad(page, '2')
    await page.locator('#btn-add-score').click()
    await pressNumpad(page, '5')
    await page.locator('#btn-add-score').click()
    await pressNumpad(page, '3')
    await page.locator('#btn-add-score').click()

    // End the game
    await page.locator('#btn-end').click()

    // Switch to Overall tab
    await page.locator('.tab-bar button[data-tab="overall"]').click()

    // Expand the moyennes list
    await page.locator('#moy-header').click()
    await expect(page.locator('#moy-list')).toHaveClass(/open/)

    // Click the last item (most recent game = item #20)
    const lastItem = page.locator('#moy-list .m-item').last()
    await expect(lastItem).toBeVisible()
    // The value should show 3.33
    await expect(lastItem.locator('.m-val')).toHaveText('3.33')
    await lastItem.click()

    // Detail overlay should be visible and open
    const overlay = page.locator('#detail-overlay')
    await expect(overlay).toBeVisible()
    await expect(overlay).toHaveClass(/open/)

    // Title should contain the moyenne
    await expect(page.locator('#detail-title')).toContainText('3.33 moy.')

    // Subtitle should mention pts and turns
    await expect(page.locator('#detail-subtitle')).toContainText('10 pts')
    await expect(page.locator('#detail-subtitle')).toContainText('3 turns')

    // Turn table should have 3 rows
    const turnRows = page.locator('#detail-tbody tr')
    await expect(turnRows).toHaveCount(3)

    // Verify first turn: # 1, Pts 2, Total 2
    const firstRow = turnRows.nth(0)
    const firstCells = firstRow.locator('td')
    await expect(firstCells.nth(0)).toHaveText('1')
    await expect(firstCells.nth(1)).toHaveText('2')
    await expect(firstCells.nth(2)).toHaveText('2')

    // Verify last turn: # 3, Pts 3, Total 10
    const lastRow = turnRows.nth(2)
    const lastCells = lastRow.locator('td')
    await expect(lastCells.nth(0)).toHaveText('3')
    await expect(lastCells.nth(1)).toHaveText('3')
    await expect(lastCells.nth(2)).toHaveText('10')
  })

  test('detail modal shows chart (SVG element present)', async ({ page }) => {
    // Play and end a game
    await pressNumpad(page, '4')
    await page.locator('#btn-add-score').click()
    await pressNumpad(page, '2')
    await page.locator('#btn-add-score').click()
    await page.locator('#btn-end').click()

    // Navigate to Overall, open list, click last item
    await page.locator('.tab-bar button[data-tab="overall"]').click()
    await page.locator('#moy-header').click()
    await page.locator('#moy-list .m-item').last().click()

    // Chart container should have an SVG
    await expect(page.locator('#detail-chart svg')).toBeVisible()
  })
})

// ============================================================
// Close detail modal
// ============================================================

test.describe('Close detail modal', () => {
  /**
   * Helper to play a game and open its detail modal.
   */
  async function playGameAndOpenDetail(page: Page) {
    await pressNumpad(page, '5')
    await page.locator('#btn-add-score').click()
    await page.locator('#btn-end').click()

    await page.locator('.tab-bar button[data-tab="overall"]').click()
    await page.locator('#moy-header').click()
    await page.locator('#moy-list .m-item').last().click()

    // Wait for modal to be open
    await expect(page.locator('#detail-overlay')).toHaveClass(/open/)
  }

  test('close via x button', async ({ page }) => {
    await playGameAndOpenDetail(page)

    // Click the close button
    await page.locator('#detail-close').click()

    // Wait for the close transition (300ms timeout in closeDetailModal)
    await expect(page.locator('#detail-overlay')).not.toHaveClass(/open/)
    // After transition, display should be none
    await page.waitForTimeout(350)
    await expect(page.locator('#detail-overlay')).toBeHidden()
  })

  test('close via backdrop click', async ({ page }) => {
    await playGameAndOpenDetail(page)

    // Click on the overlay backdrop (not on the sheet itself)
    // The overlay covers the full screen; click at top-left corner
    // which is outside the bottom sheet
    await page.locator('#detail-overlay').click({ position: { x: 10, y: 10 } })

    await expect(page.locator('#detail-overlay')).not.toHaveClass(/open/)
    await page.waitForTimeout(350)
    await expect(page.locator('#detail-overlay')).toBeHidden()
  })
})
