import assert from 'node:assert/strict'
import { generateTemporaryPassword, hashPassword, validatePasswordStrength, verifyPassword } from '../lib/passwordAuth.js'

const hashed = await hashPassword('Goodgoodmoney6789@')

assert.ok(hashed.startsWith('scrypt$'))
assert.equal(await verifyPassword('Goodgoodmoney6789@', hashed), true)
assert.equal(await verifyPassword('WrongPassword123!', hashed), false)

const weakPasswordMessage = validatePasswordStrength('weakpass')
assert.equal(typeof weakPasswordMessage, 'string')

const temporaryPassword = generateTemporaryPassword()
assert.ok(temporaryPassword.length >= 16)
assert.equal(validatePasswordStrength(temporaryPassword), null)
