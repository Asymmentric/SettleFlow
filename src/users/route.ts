import { Router } from 'express';
import { controllers } from '../container';
import { validateCreateUser, validateLoginUser } from './validation';

const UserRouter = Router();

UserRouter.post('/', validateCreateUser, controllers.user.createUser.bind(controllers.user));

UserRouter.post('/login', validateLoginUser, controllers.user.loginUser.bind(controllers.user));

export default UserRouter;
