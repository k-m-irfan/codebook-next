// File operation protocol types for WebSocket communication

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string // ISO date string
  permissions?: string // Unix permissions like 'rwxr-xr-x'
}

// Client -> Server messages
export interface FileListRequest {
  type: 'file:list'
  requestId: string
  path: string
}

export interface FileReadRequest {
  type: 'file:read'
  requestId: string
  path: string
}

export interface FileWriteRequest {
  type: 'file:write'
  requestId: string
  path: string
  content: string
  encoding?: 'utf8' | 'base64'
}

export interface FileCreateRequest {
  type: 'file:create'
  requestId: string
  path: string
  isDirectory: boolean
}

export interface FileDeleteRequest {
  type: 'file:delete'
  requestId: string
  path: string
  recursive?: boolean
}

export interface FileRenameRequest {
  type: 'file:rename'
  requestId: string
  oldPath: string
  newPath: string
}

export type FileRequest =
  | FileListRequest
  | FileReadRequest
  | FileWriteRequest
  | FileCreateRequest
  | FileDeleteRequest
  | FileRenameRequest

// Server -> Client messages
export interface FileListResponse {
  type: 'file:list:response'
  requestId: string
  success: boolean
  error?: string
  entries?: FileEntry[]
}

export interface FileReadResponse {
  type: 'file:read:response'
  requestId: string
  success: boolean
  error?: string
  content?: string
  encoding?: 'utf8' | 'base64'
  size?: number
}

export interface FileOperationResponse {
  type: 'file:operation:response'
  requestId: string
  success: boolean
  error?: string
}

export type FileResponse =
  | FileListResponse
  | FileReadResponse
  | FileOperationResponse

// Helper to check if a message is a file protocol message
export function isFileRequest(msg: any): msg is FileRequest {
  return typeof msg?.type === 'string' && msg.type.startsWith('file:')
}
