"use client"

import {
  IconCreditCard,
  IconDotsVertical,
  IconLogout,
  IconNotification,
  IconLogin,
  IconUserCircle,
} from "@tabler/icons-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/animate-ui/components/radix/sidebar"

export function NavUser({
  user,
  isAdmin,
}: {
  user: { linuxdoUserId: string; nickname: string; avatarUrl: string } | null
  isAdmin: boolean
}) {
  const { isMobile } = useSidebar()

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } catch {
      // ignore
    }
    window.location.href = "/login"
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user?.avatarUrl ?? ""} alt={user?.nickname ?? "未登录"} />
                <AvatarFallback className="rounded-lg">
                  {(user?.nickname ?? "LD").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user ? user.nickname : "未登录"}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user ? `ID ${user.linuxdoUserId}${isAdmin ? " · 管理员" : ""}` : "请先登录"}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user?.avatarUrl ?? ""} alt={user?.nickname ?? "未登录"} />
                  <AvatarFallback className="rounded-lg">
                    {(user?.nickname ?? "LD").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user ? user.nickname : "未登录"}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {user ? `ID ${user.linuxdoUserId}${isAdmin ? " · 管理员" : ""}` : "请先登录"}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user ? (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuItem disabled>
                    <IconUserCircle />
                    LinuxDO 用户
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <IconCreditCard />
                    积分支付
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    <IconNotification />
                    通知（未启用）
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    void logout()
                  }}
                >
                  <IconLogout />
                  退出登录
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem asChild>
                <a href="/login">
                  <IconLogin />
                  去登录
                </a>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
