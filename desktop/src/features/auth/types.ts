export interface ServerProfile {
  id: string
  name: string
  origin: string
  websiteUrl: string
  createdAt: string
  lastConnectedAt?: string
}

export interface SessionUser {
  id?: number
  username: string
  role?: string
  nickname?: string
  avatar?: string
}

export interface SessionResponse {
  user: SessionUser
  session?: {
    id?: string
    issuedAt?: string
    expiresAt?: string
  }
}
