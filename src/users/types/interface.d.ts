import { ObjectId } from 'mongodb';

export interface IUser {
    _id: ObjectId;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserCreate {
    name: string;
    email: string;
    password: string;
}

export interface IUserLogin {
    email: string;
    password: string;
}