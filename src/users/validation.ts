import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import AnotherError from '../utils/errors/anotherError';

const createUserSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
})

const loginUserSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
})

const validate = (
    schema: Joi.ObjectSchema,
    req: Request,
    next: NextFunction
) => {
    const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const message = error.details
            .map((detail) =>
                typeof detail.context?.message === 'string' ? detail.context.message : detail.message
            )
            .join(', ');
        return next(new AnotherError(message, 400));
    }

    req.body = value;
    next();
};

export const validateCreateUser = (req: Request, _res: Response, next: NextFunction) => {
    validate(createUserSchema, req, next);
};

export const validateLoginUser = (req: Request, _res: Response, next: NextFunction) => {
    validate(loginUserSchema, req, next);
};