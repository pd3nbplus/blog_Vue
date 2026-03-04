export interface UserProfile {
  id: number
  username: string
  email: string
  is_staff: boolean
  is_superuser: boolean
  date_joined: string
  last_login: string | null
  home_avatar_path: string
  home_hero_path: string
}

export interface LoginResult {
  token: string
  user: UserProfile
}
