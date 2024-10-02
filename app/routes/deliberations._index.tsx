import { Link } from "@remix-run/react"
import React from "react"
import { Button } from "~/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "~/components/ui/card"

export default function DeliberationsIndex() {
  return (
    <div className="container mx-auto flex items-center justify-center h-screen">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Welcome
          </CardTitle>
          <CardDescription className="text-center">
            To get started, create a new type of deliberation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link to="/deliberations/new">New Deliberation</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
