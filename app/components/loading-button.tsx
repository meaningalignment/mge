import { Loader2 } from "lucide-react"
import { Button, ButtonProps } from "./ui/button"
import { useState, useEffect } from "react"
import { useNavigation } from "@remix-run/react"

export default function LoadingButton({
  children,
  disabled,
  iconRight,
  isLoadingOnPageNavigation,
  ...props
}: ButtonProps & {
  iconRight?: React.ReactNode
  isLoadingOnPageNavigation?: boolean
}) {
  const navigation = useNavigation()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (
      navigation.state === "submitting" ||
      (isLoadingOnPageNavigation && navigation.state === "loading")
    ) {
      setIsLoading(true)
    } else if (navigation.state === "idle" && isLoading) {
      const timer = setTimeout(() => setIsLoading(false), 3_000)
      return () => clearTimeout(timer)
    }
  }, [navigation.state, isLoading])

  return (
    <Button disabled={isLoading || disabled} {...props}>
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        children
      )}
      {!isLoading && iconRight && iconRight}
    </Button>
  )
}
