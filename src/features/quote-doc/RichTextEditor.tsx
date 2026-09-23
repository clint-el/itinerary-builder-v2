import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, List } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  mono?: boolean
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 120,
  mono,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        code: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? '' }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          'max-w-none px-2.5 py-2 text-[11.5px] leading-relaxed focus:outline-none',
          mono && 'font-mono',
          '[&_.is-empty:first-child]:before:pointer-events-none [&_.is-empty:first-child]:before:float-left [&_.is-empty:first-child]:before:h-0 [&_.is-empty:first-child]:before:text-[#A1A1A1] [&_.is-empty:first-child]:before:content-[attr(data-placeholder)]',
        ),
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  if (!editor) return null

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
      <div className="flex gap-0.5 border-b border-[#E5E7EB] bg-[#FAFAFA] px-1.5 py-1">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="Bold"
        >
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="Italic"
        >
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bullet list"
        >
          <List className="size-3.5" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} style={{ minHeight }} />
    </div>
  )
}

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'rounded p-1.5 text-[#525252] transition-colors hover:bg-[#EFEFEF]',
        active && 'bg-[#E5E7EB] text-[#171717]',
      )}
    >
      {children}
    </button>
  )
}
