import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

type MarkdownContentProps = {
  className?: string
  content: string
}

const markdownComponents: Components = {
  a({ children, href, ...props }) {
    const isExternal = href ? /^https?:\/\//i.test(href) : false

    return (
      <a
        {...props}
        href={href}
        rel={isExternal ? 'noreferrer' : undefined}
        target={isExternal ? '_blank' : undefined}
      >
        {children}
      </a>
    )
  },
}

const remarkPlugins = [remarkGfm, remarkBreaks]
const rehypePlugins = [rehypeSanitize]

export function MarkdownContent({ className, content }: MarkdownContentProps) {
  return (
    <div className={['markdown-content', className].filter(Boolean).join(' ')}>
      <ReactMarkdown
        components={markdownComponents}
        rehypePlugins={rehypePlugins}
        remarkPlugins={remarkPlugins}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
