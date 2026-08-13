import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { IUser, IUserCreate, IUserLogin } from "./types/interface";
import UserDB from "./db";
import { JwtConfig } from '../config';
import AnotherError from '../utils/errors/anotherError';


export default class UserService {

    constructor(
        private readonly userDB: UserDB
    ) { }

    public async createUser(body: IUserCreate): Promise<IUser & { accessToken: string }> {

        if (!body.name || !body.email || !body.password) {
            throw new AnotherError('Name, email, and password are required', 400);
        }

        const existingUser = await this.userDB.findUserByEmail(body.email);

        if (existingUser) {
            throw new AnotherError('User with this email already exists', 400);
        }

        const hasedPassword = await bcrypt.hash(body.password, 10);
        const user = await this.userDB.createUser({ ...body, password: hasedPassword });

        const tokenBody = {
            id: user._id,
            email: user.email,
            name: user.name
        }

        const token = jwt.sign(tokenBody, JwtConfig.secret, { expiresIn: '7d' });

        return {
            ...user,
            accessToken: token
        }
    }

    public async loginUser(body: IUserLogin): Promise<IUser & { accessToken: string }> {
        if (!body.email || !body.password) {
            throw new AnotherError('Email and password are required', 400);
        }
        const existingUser = await this.userDB.findUserByEmail(body.email);

        if (!existingUser) {
            throw new AnotherError('Invalid Credentials', 401);
        }

        const isPasswordValid = await bcrypt.compare(body.password, existingUser.password);

        if (!isPasswordValid) {
            throw new AnotherError('Invalid Credentials', 401);
        }

        const tokenBody = {
            id: existingUser._id,
            email: existingUser.email,
            name: existingUser.name
        }

        const token = jwt.sign(tokenBody, JwtConfig.secret, { expiresIn: '7d' });

        return {
            _id: existingUser._id,
            email: existingUser.email,
            name: existingUser.name,
            createdAt: existingUser.createdAt,
            updatedAt: existingUser.updatedAt,
            accessToken: token
        }
    }
}