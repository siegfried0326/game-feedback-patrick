import { createClient } from "@/lib/supabase/server"
import { Header } from "./header"

export async function AuthHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const userData = user
    ? {
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name,
      }
    : null

  return <Header user={userData} />
}
