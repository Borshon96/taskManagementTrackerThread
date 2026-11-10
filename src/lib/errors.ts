export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string) => new AppError(message, 400);
export const unauthorized = (message = "Please sign in") => new AppError(message, 401);
export const forbidden = (message = "You do not have permission to do that") => new AppError(message, 403);
export const notFound = (message = "Not found") => new AppError(message, 404);
export const conflict = (message: string) => new AppError(message, 409);
