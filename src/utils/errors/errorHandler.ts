import { NextFunction, Request, Response } from 'express';
import AnotherError from './anotherError';
import NotFoundError from './404notFoundError';
import Logger from '../loggers';

export const ErrorHandler = (
    error: unknown,
    request: Request,
    response: Response,
    _next: NextFunction
) => {
    Logger.error('Request processing failed', {
        requestId: request.requestId,
        method: request.method,
        path: request.originalUrl.split('?')[0] || request.path,
        userId: request.user?.id,
        error: error instanceof Error ? error.message : String(error)
    }, error);

    if (error instanceof AnotherError || error instanceof NotFoundError) {
        return response.status(error.returnError().statusCode).json(error.returnError());
    }

    return response.status(500).json({
        success: false,
        message: 'Something went wrong',
        statusCode: 500,
    });
};
