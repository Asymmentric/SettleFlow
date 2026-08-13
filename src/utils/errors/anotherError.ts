import CustomError, { IErrorReturn } from './customError';

class AnotherError extends CustomError {
  public statusCode: number;

  constructor(message: string, code: number) {
    super(message);
    Object.setPrototypeOf(this, AnotherError.prototype);
    this.statusCode = code;
  }

  public returnError(): IErrorReturn {
    return {
      success: false,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}

export default AnotherError;
