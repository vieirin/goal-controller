import { NextResponse } from 'next/server';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data?: T;
  [key: string]: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * API response utilities for consistent response formatting
 */
export const ApiResponse = {
  /**
   * Create a success response
   */
  success<T extends Record<string, unknown>>(data: T) {
    return NextResponse.json({
      success: true,
      ...data,
    });
  },

  /**
   * Create an error response
   */
  error(message: string, status: number = 500, details?: string) {
    return NextResponse.json(
      {
        success: false,
        error: message,
        ...(details && process.env.NODE_ENV === 'development'
          ? { details }
          : {}),
      },
      { status },
    );
  },

  /**
   * Create a bad request (400) error response
   */
  badRequest(message: string) {
    return this.error(message, 400);
  },

  /**
   * Create an internal server error (500) response
   */
  serverError(message: string, details?: string) {
    return this.error(message, 500, details);
  },

  /**
   * Extract error message from unknown error
   */
  extractMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  },

  /**
   * Extract error details (stack trace) from error for debugging
   */
  extractDetails(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
  },

  /**
   * Create error response from caught exception
   */
  fromError(error: unknown, status: number = 500) {
    return this.error(
      this.extractMessage(error),
      status,
      this.extractDetails(error),
    );
  },
};
