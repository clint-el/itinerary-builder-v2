import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function DocumentSendDialog({
  open,
  onOpenChange,
  title,
  description,
  defaultRecipient,
  onSend,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  defaultRecipient?: string
  onSend: (recipient: string) => void
}) {
  const [recipient, setRecipient] = useState(defaultRecipient || '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-[#525252]">
          Agent email
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="agent@example.com"
            className="h-10 rounded-lg border border-[#E5E7EB] px-3 text-[13px] font-normal"
          />
        </label>
        <Button
          className="bg-[#931115] hover:bg-[#7a0e12]"
          onClick={() => {
            onSend(recipient.trim())
            onOpenChange(false)
          }}
        >
          <Mail className="size-3.5" /> Send and record delivery
        </Button>
      </DialogContent>
    </Dialog>
  )
}
