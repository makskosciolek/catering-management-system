import { expect, test } from '@playwright/test'

test('klient składa zamówienie, a menedżer znajduje je w swoim panelu', async ({
  page,
  browser,
  baseURL,
}, info) => {
  const email = 'e2e-' + Date.now() + '@example.com'
  const address = 'ul. Testowa 15, Kraków'
  // Pojutrze jest dozwolone niezależnie od godziny granicznej przyjmowania zamówień.
  const deliveryDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }).format(
    new Date(Date.now() + 2 * 86_400_000),
  )
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
  await page.getByLabel('Termin dostawy').fill(deliveryDay)
  await page.getByLabel('Adres dostawy').fill(address)
  await page.getByLabel('Telefon kontaktowy').fill('000 000 000')
  let submitted = 0
  await page.route('**/api/orders/v1/orders/', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    submitted++
    expect((await route.fetch()).status()).toBe(201)
    await route.abort()
  })
  await page.getByRole('button', { name: 'Złóż zamówienie' }).click()
  await expect(page.getByRole('alert')).toContainText('Nie udało się połączyć')
  await page.reload()
  await page.getByRole('button', { name: 'Sprawdź, czy zamówienie zostało zapisane' }).click()
  await expect(page.getByText('Zamówienie zostało zapisane.')).toBeVisible()
  expect(submitted).toBe(1)
  await expect(page.getByText('Składniki zarezerwowane')).toBeVisible({ timeout: 15_000 })
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

test('zaległe zdarzenie trafia do magazynu i rezerwacja znika po anulowaniu', async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Dane klienta' }).click()
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click()
  await page.getByRole('link', { name: 'Zamówienia' }).click()
  await page.getByRole('link', { name: /^CH-/ }).click()
  await expect(page.getByText('Składniki zarezerwowane')).toBeVisible({ timeout: 15_000 })
  const cancelButton = page.getByRole('button', { name: 'Anuluj zamówienie' })
  for (const width of [390, 1280, 1536, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(cancelButton).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width)
  }
  const orderId = new URL(page.url()).pathname.split('/').at(-1)
  const warehouse = await browser.newContext({ baseURL })
  try {
    const stockApi = warehouse.request
    const csrf = await stockApi.get('/api/orders/v1/auth/csrf/')
    const { csrfToken } = await csrf.json()
    expect(
      (
        await stockApi.post('/api/orders/v1/auth/login/', {
          data: { email: 'magazyn@smakbox.example', password: 'SmakBox-demo-2026!' },
          headers: { 'X-CSRFToken': csrfToken },
        })
      ).ok(),
    ).toBeTruthy()
    const reservation = '/api/inventory/v1/reservations/' + orderId + '/'
    expect((await (await stockApi.get(reservation)).json()).status).toBe('reserved')
    page.once('dialog', (dialog) => dialog.accept())
    await cancelButton.focus()
    await expect(cancelButton).toBeFocused()
    await cancelButton.press('Enter')
    await expect(page.getByText('Anulowane', { exact: true })).toBeVisible()
    await expect
      .poll(async () => (await (await stockApi.get(reservation)).json()).status, {
        timeout: 15_000,
      })
      .toBe('cancelled')
  } finally {
    await warehouse.close()
  }
})

test('błąd odświeżania menu nie pozwala wysłać niepełnego koszyka', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Dane klienta' }).click()
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click()
  await page.getByRole('button', { name: 'Dodaj Kurczak z pieca', exact: true }).click()
  await page.getByRole('button', { name: 'Dodaj Krem z pomidorów', exact: true }).click()
  let fail = false
  await page.route('**/api/orders/v1/menu/', async (route) => {
    if (fail) return route.abort()
    const response = await route.fetch()
    const meals: { name: string }[] = await response.json()
    return route.fulfill({
      response,
      json: meals.filter((meal) => meal.name !== 'Kurczak z pieca'),
    })
  })
  const reloadMenu = async () => {
    await page.getByRole('link', { name: 'Mój profil', exact: true }).click()
    await page.getByRole('link', { name: 'Menu', exact: true }).click()
  }
  await reloadMenu()
  await expect(page.getByRole('button', { name: 'Usuń niedostępne' })).toBeVisible()
  fail = true
  await reloadMenu()
  await expect(
    page.getByText('Nie udało się połączyć z aplikacją. Spróbuj ponownie.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Usuń niedostępne' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Złóż zamówienie' })).toBeDisabled()
})

test('po utracie sesji panel ukrywa zapisane dane', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Dane menedżera' }).click()
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click()
  await expect(page.getByRole('table')).toBeVisible()
  const csrf = await page.request.get('/api/orders/v1/auth/csrf/')
  const { csrfToken } = await csrf.json()
  expect(
    (
      await page.request.post('/api/orders/v1/auth/logout/', {
        headers: { 'X-CSRFToken': csrfToken },
      })
    ).status(),
  ).toBe(204)
  await expect(page.getByRole('heading', { name: 'Zaloguj się' })).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})
