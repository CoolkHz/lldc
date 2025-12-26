"use client"

import * as React from "react"
import {
  IconCamera,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconHelp,
  IconInnerShadowTop,
  IconReport,
  IconSearch,
  IconSettings,
} from "@tabler/icons-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/animate-ui/components/radix/sidebar"

type MeResponse = {
  user: {
    linuxdoUserId: string
    nickname: string
    avatarUrl: string
  }
  isAdmin: boolean
}

const data = {
  navMain: [
    {
      title: "抽奖面板",
      url: "/dashboard",
      icon: IconDashboard,
    },
  ],
  navClouds: [
    {
      title: "功能",
      icon: IconCamera,
      isActive: true,
      url: "#",
      items: [
        {
          title: "本期概览",
          url: "#",
        },
        {
          title: "参与者排行",
          url: "#",
        },
      ],
    },
    {
      title: "订单",
      icon: IconFileDescription,
      url: "#",
      items: [
        {
          title: "我的订单",
          url: "#",
        },
        {
          title: "订单详情",
          url: "#",
        },
      ],
    },
    {
      title: "开奖记录",
      icon: IconFileAi,
      url: "#",
      items: [
        {
          title: "往期开奖",
          url: "#",
        },
        {
          title: "开奖详情",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "设置",
      url: "#",
      icon: IconSettings,
    },
    {
      title: "帮助",
      url: "#",
      icon: IconHelp,
    },
  ],
  documents: [
    {
      name: "我的订单",
      url: "/dashboard/orders",
      icon: IconDatabase,
    },
    {
      name: "往期开奖",
      url: "/dashboard/draws",
      icon: IconReport,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [me, setMe] = React.useState<MeResponse | null>(null)

  React.useEffect(() => {
    const ac = new AbortController()
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { signal: ac.signal, credentials: "include" })
        if (res.status === 401) {
          window.location.replace("/login")
          return
        }
        if (!res.ok) {
          setMe(null)
          return
        }
        const json = (await res.json()) as unknown
        if (!json || typeof json !== "object") {
          setMe(null)
          return
        }
        setMe(json as MeResponse)
      } catch {
        setMe(null)
      }
    })()
    return () => ac.abort()
  }, [])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Lucky Ldc.</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={me?.user ?? null} isAdmin={me?.isAdmin ?? false} />
      </SidebarFooter>
    </Sidebar>
  )
}
