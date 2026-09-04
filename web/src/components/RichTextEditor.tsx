'use client'

import { useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import ImageExtension from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import DOMPurify from 'dompurify'
import { api } from '@/lib/api'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

let isHookAdded = false

function sanitize(html: string): string {
  if (typeof window === 'undefined') return html
  if (!isHookAdded && typeof DOMPurify?.addHook === 'function') {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
    isHookAdded = true
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
      'h1', 'h2', 'h3', 'h4',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'img', 'a', 'hr',
    ],
    ALLOWED_ATTR: [
      'src', 'alt', 'width', 'height', 'style',
      'href', 'target', 'rel',
    ],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  })
}

async function uploadImage(file: File): Promise<string | null> {
  if (file.size > 3 * 1024 * 1024) return null
  if (!file.type.startsWith('image/')) return null

  const form = new FormData()
  form.append('file', file)
  form.append('type', 'description')
  try {
    const result = await api.upload<{ url: string }>('/media', form)
    return result.url
  } catch {
    return null
  }
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      ImageExtension.configure({
        inline: false,
        allowBase64: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? '',
      }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => {
      onChange(sanitize(e.getHTML()))
    },
    editorProps: {
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (!file) return true
            void uploadImage(file).then((url) => {
              if (url && view.state) {
                const { schema, tr } = view.state
                const node = schema.nodes.image.create({ src: url })
                view.dispatch(tr.replaceSelectionWith(node))
              }
            })
            return true
          }
        }
        return false
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files
        if (!files?.length) return false

        const file = files[0]
        if (!file.type.startsWith('image/')) return false

        event.preventDefault()
        void uploadImage(file).then((url) => {
          if (url && view.state) {
            const { schema, tr } = view.state
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
            const node = schema.nodes.image.create({ src: url })
            if (pos) {
              view.dispatch(tr.insert(pos.pos, node))
            }
          }
        })
        return true
      },
    },
  })

  const handleImageButton = useCallback(() => {
    fileRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !editor) return
      const url = await uploadImage(file)
      if (url) {
        editor.chain().focus().setImage({ src: url }).run()
      }
      e.target.value = ''
    },
    [editor],
  )

  if (!editor) return null

  return (
    <div className="rte">
      <div className="rte-toolbar">
        <div className="rte-group">
          <button
            type="button"
            className={editor.isActive('bold') ? 'rte-btn on' : 'rte-btn'}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <b>B</b>
          </button>
          <button
            type="button"
            className={editor.isActive('italic') ? 'rte-btn on' : 'rte-btn'}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            className={editor.isActive('underline') ? 'rte-btn on' : 'rte-btn'}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
          >
            <u>U</u>
          </button>
          <button
            type="button"
            className={editor.isActive('strike') ? 'rte-btn on' : 'rte-btn'}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <s>S</s>
          </button>
        </div>

        <span className="rte-sep" />

        <div className="rte-group">
          <button
            type="button"
            className={editor.isActive('heading', { level: 2 }) ? 'rte-btn on' : 'rte-btn'}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            className={editor.isActive('heading', { level: 3 }) ? 'rte-btn on' : 'rte-btn'}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          >
            H3
          </button>
        </div>

        <span className="rte-sep" />

        <div className="rte-group">
          <button
            type="button"
            className={editor.isActive({ textAlign: 'left' }) ? 'rte-btn on' : 'rte-btn'}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            title="Align left"
          >
            &#9776;
          </button>
          <button
            type="button"
            className={editor.isActive({ textAlign: 'center' }) ? 'rte-btn on' : 'rte-btn'}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            title="Align center"
          >
            &#9783;
          </button>
          <button
            type="button"
            className={editor.isActive({ textAlign: 'right' }) ? 'rte-btn on' : 'rte-btn'}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            title="Align right"
          >
            &#9782;
          </button>
        </div>

        <span className="rte-sep" />

        <div className="rte-group">
          <button
            type="button"
            className={editor.isActive('bulletList') ? 'rte-btn on' : 'rte-btn'}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            &bull;
          </button>
          <button
            type="button"
            className={editor.isActive('orderedList') ? 'rte-btn on' : 'rte-btn'}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
          >
            1.
          </button>
          <button
            type="button"
            className={editor.isActive('blockquote') ? 'rte-btn on' : 'rte-btn'}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
          >
            &ldquo;
          </button>
        </div>

        <span className="rte-sep" />

        <div className="rte-group">
          <button type="button" className="rte-btn" onClick={handleImageButton} title="Insert image">
            &#128247;
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>
      <EditorContent editor={editor} className="rte-content" />
    </div>
  )
}

/** Render sanitized HTML safely. Use this to display stored description HTML. */
export function SafeHtml({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitize(html) }}
    />
  )
}
