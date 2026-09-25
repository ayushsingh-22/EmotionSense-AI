import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Strips common markdown syntax from a string, for use in plain-text
 * previews (card excerpts, line-clamped snippets) where full markdown
 * rendering isn't appropriate but the raw `**`/`#`/list-marker source
 * shouldn't leak through either.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '') // headers
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1') // bold+italic
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1') // italic
    .replace(/__(.+?)__/g, '$1') // bold (underscore)
    .replace(/_(.+?)_/g, '$1') // italic (underscore)
    .replace(/`{1,3}([^`]+?)`{1,3}/g, '$1') // inline/code blocks
    .replace(/^\s*[-*+]\s+/gm, '') // bullet list markers
    .replace(/^\s*\d+\.\s+/gm, '') // numbered list markers
    .replace(/^\s*>\s?/gm, '') // blockquotes
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links -> text
    .trim();
}
