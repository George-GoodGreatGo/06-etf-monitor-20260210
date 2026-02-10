import { randomUUID } from 'node:crypto'

export const serverStartedAt = new Date().toISOString()
export const serverBootId = randomUUID()

