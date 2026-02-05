export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface FsNode {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface ListDirectoryOptions {
  limit?: number;
  cursor?: string;
}

export interface FileVersion {
  id: string;
  version: number;
  size: number;
  createdAt: string;
  createdBy: string;
}
