import OrderController from './orders/controller';
import OrderDB from './orders/db';
import OrderService from './orders/service';
import UserController from './users/controller';
import UserDB from './users/db';
import UserService from './users/service';

export const orderDb = new OrderDB();

const userService = new UserService(new UserDB())
const orderService = new OrderService(orderDb);


const services = {
    user: userService,
    order: orderService
};

export const controllers = {
    user: new UserController(services.user),
    order: new OrderController(services.order)
};

