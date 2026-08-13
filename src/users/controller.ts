import { NextFunction, Request, Response } from 'express';
import UserService from './service';
import Logger from '../utils/loggers';

export default class UserController {
    constructor(
        private readonly userService: UserService
    ) { }

    public async createUser(req: Request, res: Response, next: NextFunction) {
        try {
            const user = await this.userService.createUser(req.body);
            Logger.info('User account created', {
                requestId: req.requestId,
                userId: user._id.toString()
            });
            res.status(201).json({ success: true, data: user });
        }
        catch (error) {
            next(error);
        }
    }

    public async loginUser(req: Request, res: Response, next: NextFunction) {
        try {
            const user = await this.userService.loginUser(req.body);
            Logger.info('User login succeeded', {
                requestId: req.requestId,
                userId: user._id.toString()
            });
            res.status(200).json({ success: true, data: user });
        }
        catch (error) {
            next(error);
        }
    }

}
