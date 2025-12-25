const AUTHORIZE_ENDPOINT = "https://connect.linux.do/oauth2/authorize"
const TOKEN_ENDPOINT = "https://connect.linux.do/oauth2/token"
const USERINFO_ENDPOINT = "https://connect.linux.do/api/user"

export const LINUXDO_OAUTH_STATE_COOKIE = "linuxdo_oauth_state"

export type LinuxdoTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  [key: string]: unknown
}

export type LinuxdoUser = {
  id: string | number
  username: string
  name?: string | null
  avatar_template?: string | null
  active?: boolean
  trust_level?: number
  silenced?: boolean
  [key: string]: unknown
}

export function generateOauthState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  const b64 = btoa(binary)
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export function buildAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  scope?: string
}): string {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
  })
  if (params.scope) query.set("scope", params.scope)
  return `${AUTHORIZE_ENDPOINT}?${query.toString()}`
}

export async function exchangeToken(params: {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
}): Promise<LinuxdoTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
  })

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: body.toString(),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${text}`.slice(0, 500))
  }

  try {
    return JSON.parse(text) as LinuxdoTokenResponse
  } catch {
    const parsed: Record<string, string> = {}
    new URLSearchParams(text).forEach((value, key) => {
      parsed[key] = value
    })
    return parsed as unknown as LinuxdoTokenResponse
  }
}

export async function fetchUserInfo(accessToken: string): Promise<LinuxdoUser> {
  const response = await fetch(USERINFO_ENDPOINT, {
    method: "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
    },
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Userinfo failed: ${response.status} ${text}`.slice(0, 500))
  }

  const json = JSON.parse(text) as unknown
  if (!json || typeof json !== "object") throw new Error("Invalid userinfo response")

  const user = json as Partial<LinuxdoUser>
  if (user.id === undefined || user.id === null || !user.username) {
    throw new Error("Missing user fields")
  }
  return user as LinuxdoUser
}

export function resolveAvatarUrl(avatarTemplate: string | null | undefined, size = 128): string {
  const template = (avatarTemplate ?? "").trim()
  if (!template) return "https://connect.linux.do/images/default-avatar.png"
  const withSize = template.replace("{size}", String(size))
  if (withSize.startsWith("http://") || withSize.startsWith("https://")) return withSize
  if (withSize.startsWith("/")) return `https://connect.linux.do${withSize}`
  return `https://connect.linux.do/${withSize}`
}

