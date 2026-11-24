const TZ = 'America/Santiago'
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

interface Parts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function chileParts(ms: number): Parts {
  const p: Record<string, string> = {}
  for (const { type, value } of formatter.formatToParts(ms)) p[type] = value
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
  }
}

/** Diferencia (minutos) entre la hora de Chile y UTC en ese instante. Negativa: −180 en verano, −240 en invierno. */
function offsetMinutes(ms: number): number {
  const p = chileParts(ms)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Convierte fecha ("AAAA-MM-DD") y hora ("HH:MM") de Chile a milisegundos UTC. */
export function chileToUtc(date: string, time: string): number {
  const d = DATE_RE.exec(date)
  const t = TIME_RE.exec(time)
  if (!d || !t) throw new RangeError(`Fecha u hora inválida: "${date} ${time}"`)
  const [y, mo, da] = [Number(d[1]), Number(d[2]), Number(d[3])]
  const guess = Date.UTC(y, mo - 1, da, Number(t[1]), Number(t[2]))
  const check = new Date(guess)
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== da) {
    throw new RangeError(`Fecha inválida: "${date}"`)
  }
  // Dos pasadas: el desfase depende del instante, que depende del desfase.
  const first = offsetMinutes(guess)
  const second = offsetMinutes(guess - first * 60000)
  return guess - second * 60000
}

/** Fecha y hora actuales en Chile. */
export function chileNow(now: number = Date.now()): { date: string; time: string } {
  const p = chileParts(now)
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` }
}

export function hhmmToMinutes(time: string): number {
  const t = TIME_RE.exec(time)
  if (!t) throw new RangeError(`Hora inválida: "${time}"`)
  return Number(t[1]) * 60 + Number(t[2])
}

export function minutesToHhmm(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) {
    throw new RangeError(`Minutos fuera de rango: ${minutes}`)
  }
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}
