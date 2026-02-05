/**
 * Error thrown by FsProvider operations.
 */
export class FsProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'FsProviderError';
  }
}

// Error codes
export const ErrorCodes = {
  PATH_EXISTS: 'PATH_EXISTS',
  PATH_IS_FILE: 'PATH_IS_FILE',
  PATH_IS_DIRECTORY: 'PATH_IS_DIRECTORY',
  NOT_FOUND: 'NOT_FOUND',
  BLOB_NOT_FOUND: 'BLOB_NOT_FOUND',
  CANNOT_DELETE_ROOT: 'CANNOT_DELETE_ROOT',
  CANNOT_MOVE_ROOT: 'CANNOT_MOVE_ROOT',
  INVALID_DESTINATION: 'INVALID_DESTINATION',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
