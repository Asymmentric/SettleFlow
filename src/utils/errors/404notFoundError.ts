import CustomError, { IErrorReturn } from './customError';

class NotFoundError extends CustomError {
  constructor(message = 'Resource not found') {
    super(message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }

  public returnError(): IErrorReturn {
    return {
      success: false,
      message: this.message,
      statusCode: 404,
    };
  }
}

export default NotFoundError;
