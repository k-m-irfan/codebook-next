export type FileType = 'text' | 'image' | 'video' | 'pdf' | 'notebook'

export function getFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image'
  if (['mp4', 'webm', 'mov', 'ogg'].includes(ext)) return 'video'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'ipynb') return 'notebook'
  return 'text'
}

export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const mimeMap: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    // Videos
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    ogg: 'video/ogg',
    // Documents
    pdf: 'application/pdf',
  }
  return mimeMap[ext] || 'application/octet-stream'
}

export function isPreviewable(filename: string): boolean {
  const fileType = getFileType(filename)
  return fileType !== 'text'
}
