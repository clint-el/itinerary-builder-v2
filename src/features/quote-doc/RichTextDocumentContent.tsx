import { hasRichTextContent } from '@/features/quote-doc/quoteTextModel'
import { cn } from '@/shared/lib/utils'

type RichTextVariant = 'bullets' | 'plain' | 'muted'

const VARIANT_STYLES: Record<RichTextVariant, string> = {
  bullets:
    '[&_ol]:mt-0 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-4 [&_ol]:text-[11.5px] [&_ol]:leading-relaxed [&_ol]:text-[#3D3D3D] [&_p]:m-0 [&_ul]:mt-0 [&_ul]:list-none [&_ul]:space-y-1.5 [&_ul]:p-0 [&_ul]:text-[11.5px] [&_ul]:leading-relaxed [&_ul]:text-[#3D3D3D] [&_li]:flex [&_li]:gap-2 [&_li]:before:shrink-0 [&_li]:before:content-["·"] [&_li]:before:text-[#931115]',
  plain:
    '[&_li]:text-[11.5px] [&_li]:leading-snug [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:m-0 [&_p]:text-[11.5px] [&_p]:leading-snug [&_ul]:list-disc [&_ul]:pl-4',
  muted:
    '[&_li]:text-[11px] [&_li]:leading-relaxed [&_li]:text-[#8A8A8A] [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:m-0 [&_p]:text-[11px] [&_p]:leading-relaxed [&_p]:text-[#8A8A8A] [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4',
}

export function RichTextDocumentContent({
  html,
  variant = 'bullets',
  className,
}: {
  html: string
  variant?: RichTextVariant
  className?: string
}) {
  if (!hasRichTextContent(html)) return null

  return (
    <div
      className={cn('rich-text-document', VARIANT_STYLES[variant], className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
