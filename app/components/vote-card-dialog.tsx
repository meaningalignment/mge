import { contextDisplayName } from "~/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"

export default function VoteCardDialog({
  open,
  link,
  onClose,
  onClickValue,
  onClickContext,
  graphData,
}: {
  open: boolean
  link: any
  onClose: () => void
  onClickValue: (value: any) => void
  onClickContext: (contextId: string) => void
  graphData: any
}) {
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm animate-fade-in">
        <DialogHeader>
          <DialogTitle
            className="text-sm font-semibold text-muted-foreground cursor-pointer hover:underline"
            onClick={() => onClickContext(graphData?.edges[0]?.contexts[0])}
          >
            {contextDisplayName(graphData?.edges[0]?.contexts[0]) ||
              "Context Information"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-base mb-6">
            Is it wiser to follow{" "}
            <em
              className="font-semibold cursor-pointer hover:underline"
              onClick={() => onClickValue(link?.target)}
            >
              {link?.target.title}
            </em>{" "}
            rather than{" "}
            <em
              className="font-semibold cursor-pointer hover:underline"
              onClick={() => onClickValue(link?.source)}
            >
              {link?.source.title}
            </em>
            ?
          </p>

          <div className="space-y-2">
            <div className="flex justify-between">
              <p className="font-bold">Wiser</p>
              <p className="text-muted-foreground">
                {link?.counts?.markedWiser ?? 0} participants
              </p>
            </div>
            <div className="flex justify-between">
              <p className="font-bold">Not Wiser</p>
              <p className="text-muted-foreground">
                {link?.counts?.markedNotWiser ?? 0} participants
              </p>
            </div>
            {(link?.counts?.markedLessWise ?? 0) > 0 && (
              <div className="flex justify-between">
                <p className="font-bold">Less Wise</p>
                <p className="text-muted-foreground">
                  {link?.counts?.markedLessWise ?? 0} participants
                </p>
              </div>
            )}
            <div className="flex justify-between">
              <p className="font-bold">Unsure</p>
              <p className="text-muted-foreground">
                {link?.counts?.markedUnsure ?? 0} participants
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
