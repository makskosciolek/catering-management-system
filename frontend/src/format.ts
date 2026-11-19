const moneyFormat = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })
const dateFormat = new Intl.DateTimeFormat('pl-PL', {
  dateStyle: 'medium',
  timeZone: 'Europe/Warsaw',
})
const isoDateFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Warsaw',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const money = (value: string | number) => moneyFormat.format(Number(value))
export const dateLabel = (value: string) =>
  dateFormat.format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value))
export const today = () => isoDateFormat.format(new Date())

// Ta sama reguła co ORDER_CUTOFF_HOUR w serwisie Zamówień: zamówienie na jutro
// można złożyć do 18:00, później najbliższy termin to pojutrze.
// Ostatecznie decyduje serwer, a tutaj ustawiamy tylko minimum w formularzu.
export const ORDER_CUTOFF_HOUR = 18
const hourFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Warsaw',
  hour: '2-digit',
  hourCycle: 'h23',
})
export const earliestDeliveryDate = (now = new Date()) => {
  const days = Number(hourFormat.format(now)) < ORDER_CUTOFF_HOUR ? 1 : 2
  const date = new Date(isoDateFormat.format(now) + 'T12:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export const orderCode = (id: string) => 'CH-' + id.slice(0, 8).toUpperCase()
