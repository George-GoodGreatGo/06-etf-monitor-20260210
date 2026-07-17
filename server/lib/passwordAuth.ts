import crypto from 'node:crypto'

function scryptAsync(password: string, salt: Buffer, keylen: number, options: crypto.ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error)
        return
      }
      resolve(Buffer.from(derivedKey))
    })
  })
}

const PASSWORD_MIN_LENGTH = 12
const TEMP_PASSWORD_LENGTH = 18
const PASSWORD_SPECIALS = '!@#$%^&*()-_=+[]{}:,.?'
const PASSWORD_CHARSET = `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789${PASSWORD_SPECIALS}`

type ParsedHash = {
  cost: number
  blockSize: number
  parallelization: number
  salt: Buffer
  hash: Buffer
}

function randomChar(chars: string): string {
  return chars[crypto.randomInt(0, chars.length)]
}

function shuffle(chars: string[]): string {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const swapIndex = crypto.randomInt(0, i + 1)
    const current = chars[i]
    chars[i] = chars[swapIndex]
    chars[swapIndex] = current
  }
  return chars.join('')
}

function parseStoredHash(storedHash: string): ParsedHash | null {
  const parts = String(storedHash || '').split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null
  const cost = Number.parseInt(parts[1] || '', 10)
  const blockSize = Number.parseInt(parts[2] || '', 10)
  const parallelization = Number.parseInt(parts[3] || '', 10)
  const salt = parts[4] ? Buffer.from(parts[4], 'base64url') : null
  const hash = parts[5] ? Buffer.from(parts[5], 'base64url') : null
  if (!salt || !hash || !Number.isFinite(cost) || !Number.isFinite(blockSize) || !Number.isFinite(parallelization)) {
    return null
  }
  return { cost, blockSize, parallelization, salt, hash }
}

export function validatePasswordStrength(password: string): string | null {
  const raw = String(password || '')
  if (raw.length < PASSWORD_MIN_LENGTH) {
    return `密码长度不能少于 ${PASSWORD_MIN_LENGTH} 位`
  }
  if (!/[A-Z]/.test(raw)) return '密码必须包含至少 1 个大写字母'
  if (!/[a-z]/.test(raw)) return '密码必须包含至少 1 个小写字母'
  if (!/[0-9]/.test(raw)) return '密码必须包含至少 1 个数字'
  if (!/[!@#$%^&*()\-_=+[\]{}:,.?]/.test(raw)) return '密码必须包含至少 1 个特殊字符'
  return null
}

export async function hashPassword(password: string): Promise<string> {
  const normalized = String(password || '')
  const salt = crypto.randomBytes(16)
  const cost = 16384
  const blockSize = 8
  const parallelization = 1
  const derived = (await scryptAsync(normalized, salt, 64, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 32 * 1024 * 1024,
  })) as Buffer
  return [
    'scrypt',
    String(cost),
    String(blockSize),
    String(parallelization),
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parseStoredHash(storedHash)
  if (!parsed) return false
  const derived = (await scryptAsync(String(password || ''), parsed.salt, parsed.hash.length, {
    N: parsed.cost,
    r: parsed.blockSize,
    p: parsed.parallelization,
    maxmem: 32 * 1024 * 1024,
  })) as Buffer
  if (derived.length !== parsed.hash.length) return false
  return crypto.timingSafeEqual(derived, parsed.hash)
}

export function generateTemporaryPassword(): string {
  const chars = [
    randomChar('ABCDEFGHJKLMNPQRSTUVWXYZ'),
    randomChar('abcdefghijkmnopqrstuvwxyz'),
    randomChar('23456789'),
    randomChar(PASSWORD_SPECIALS),
  ]
  while (chars.length < TEMP_PASSWORD_LENGTH) {
    chars.push(randomChar(PASSWORD_CHARSET))
  }
  return shuffle(chars)
}
