import { createClient } from "@/lib/supabase/server"
import { AnalyzeHeader } from "./analyze-header"

export async function AuthAnalyzeHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const userData = user
    ? {
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name,
      }
    : null

  return <AnalyzeHeader user={userData} />
}
