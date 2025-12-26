import { GalleryVerticalEnd } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/animate-ui/components/buttons/button"
import {
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-8 items-center justify-center rounded-md">
            <GalleryVerticalEnd className="size-6" />
          </div>
          <h1 className="text-xl font-bold">Lucky Ldc.</h1>
          <FieldDescription>使用 LinuxDO 登录</FieldDescription>
        </div>
        <Button asChild className="w-full">
          <a href="/api/auth/login">继续使用 LinuxDO</a>
        </Button>
        <FieldDescription className="text-center">
          点击继续即表示你同意 <a href="#">服务政策</a> 和 <a href="#">隐私条款</a>。
        </FieldDescription>
      </FieldGroup>
    </div>
  )
}
