export interface IErrorReturn {
  success: boolean;
  message: string;
  statusCode: number;
}

abstract class CustomError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, CustomError.prototype);
  }

  abstract returnError(): IErrorReturn;
}

export default CustomError;
