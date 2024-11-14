import type { MetaFunction } from "@remix-run/node"
import { useNavigate } from "@remix-run/react"
import { useEffect } from "react"
import { useCurrentUser } from "../root"

export const meta: MetaFunction = () => {
  return [
    { title: "Moral Graph Deliberation" },
    { name: "description", content: "Welcome to MGD!" },
  ]
}

export default function Index() {
  const user = useCurrentUser()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      navigate("/auth/login")
    } else {
      navigate("/dashboard")
    }
  }, [user, navigate])

  return null
}
