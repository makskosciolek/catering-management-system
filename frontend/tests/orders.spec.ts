import { expect, test } from '@playwright/test'

test('klient składa zamówienie, a menedżer znajduje je w swoim panelu', async ({
  page,
  browser,
  baseURL,
}, info) => {
  const email = 'e2e-' + Date.now() + '@example.com'
  const address = 'ul. Testowa 15, Kraków'
  const nextDay = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  await page.goto('/register')
  await page.getByLabel('Imię', { exact: true }).fill('Ewa')
  await page.getByLabel('Nazwisko', { exact: true }).fill('Testowa')
  await page.getByLabel('Adres e-mail').fill(email)
  await page.getByLabel('Hasło').fill('Browser-check-2026!')
  await page.getByRole('button', { name: 'Utwórz konto' }).click()
  await expect(page.getByRole('heading', { name: 'Menu SmakBox' })).toBeVisible()
  const add = page.getByRole('button', { name: 'Dodaj Kurczak z pieca', exact: true })
  await expect(add).toBeVisible()
  await page.screenshot({ path: info.outputPath('menu-desktop.png') })
  await add.click()
  await add.click()
  await page.getByLabel('Termin dostawy').fill(nextDay)
  await page.getByLabel('Adres dostawy').fill(address)
  await page.getByLabel('Telefon kontaktowy').fill('000 000 000')
  await page.getByRole('button', { name: 'Złóż zamówienie' }).click()
  await expect(page.getByText('Zamówienie zostało zapisane.')).toBeVisible()
  await expect(page.getByText('Oczekuje na magazyn')).toBeVisible()
  await expect(page.getByText(/69,80/).first()).toBeVisible()
  await page.reload()
  await expect(page.getByText(address)).toBeVisible()
  const orderCode = await page.getByRole('heading', { level: 1 }).innerText()
  const staff = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } })
  try {
    const manager = await staff.newPage()
    await manager.goto('/login')
    await manager.getByRole('button', { name: 'Dane menedżera' }).click()
    await manager.getByRole('button', { name: 'Zaloguj się', exact: true }).click()
    await expect(manager.getByRole('heading', { name: 'Panel zamówień' })).toBeVisible()
    await manager.getByLabel('Szukaj zamówienia').fill(email)
    await expect(manager.getByRole('link', { name: orderCode })).toBeVisible()
    await manager.screenshot({ path: info.outputPath('manager.png') })
    await manager.getByRole('link', { name: orderCode }).click()
    await expect(manager.getByText(address)).toBeVisible()
  } finally {
    await staff.close()
  }
})

test('menu w telefonie pozwala filtrować dania bez przepełnienia układu', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/menu')
  await expect(page.getByRole('heading', { name: 'Menu SmakBox' })).toBeVisible()
  await page.getByRole('button', { name: 'Zupy', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Krem z pomidorów' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Kurczak z pieca' })).toHaveCount(0)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390)
  await page.screenshot({ path: info.outputPath('menu-mobile.png') })
})
