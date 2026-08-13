import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import AnotherError from './errors/anotherError';
import NotFoundError from './errors/404notFoundError';
import { JwtConfig } from '../config';
import Logger from './loggers';

interface IAccessTokenPayload extends JwtPayload {
    id: string;
    email: string;
    name: string;
}

/**
 * Logs the lifecycle of every API request without recording bodies,
 * authorization headers, passwords, payment notes, or other sensitive input.
 */
export const requestLogger = (request: Request, response: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const startedAt = process.hrtime.bigint();
    const requestPath = request.originalUrl.split('?')[0] || request.path;
    let completed = false;

    request.requestId = requestId;
    response.setHeader('X-Request-ID', requestId);

    Logger.info('API request started', {
        requestId,
        method: request.method,
        path: requestPath,
        ip: request.ip
    });

    const logCompletion = (event: 'finished' | 'aborted') => {
        if (completed) return;
        completed = true;

        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const details = {
            requestId,
            method: request.method,
            path: requestPath,
            statusCode: response.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            userId: request.user?.id,
            event
        };

        if (event === 'aborted' || response.statusCode >= 500) {
            Logger.error('API request completed', details);
        } else if (response.statusCode >= 400) {
            Logger.warn('API request completed', details);
        } else {
            Logger.info('API request completed', details);
        }
    };

    response.once('finish', () => logCompletion('finished'));
    response.once('close', () => {
        if (!response.writableEnded) logCompletion('aborted');
    });

    next();
};

export const notFoundHandler = (_request: Request, _response: Response, next: NextFunction) => {
    next(new NotFoundError());
};

export const authHandler = (request: Request, _response: Response, next: NextFunction) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return next(new AnotherError('Authorization token is required', 401));
    }

    const token = authHeader.slice('Bearer '.length).trim();

    try {
        const payload = jwt.verify(token, JwtConfig.secret) as IAccessTokenPayload;

        if (!payload.id) {
            return next(new AnotherError('Invalid authorization token', 401));
        }

        request.user = { id: payload.id, email: payload.email, name: payload.name };
        next();
    } catch {
        next(new AnotherError('Invalid authorization token', 401));
    }
};
