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
export const orderCode = (id: string) => 'CH-' + id.slice(0, 8).toUpperCase()
