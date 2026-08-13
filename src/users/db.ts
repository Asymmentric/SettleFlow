import moment from 'moment';
import Db, { DB_COLLECTIONS } from '../config/database/mongo'
import { IUser, IUserCreate } from './types/interface';


export default class UserDB {

    public async createUser(user: IUserCreate): Promise<IUser> {
        const query = {
            name: user.name,
            email: user.email,
            password: user.password,
            createdAt: moment().toDate(),
            updatedAt: moment().toDate()
        }
        const result = await Db.Instance.collection(DB_COLLECTIONS.USERS).insertOne(query);

        return {
            _id: result.insertedId,
            name: query.name,
            email: query.email,
            createdAt: query.createdAt,
            updatedAt: query.updatedAt
        }
    }

    public async findUserByEmail(email: string): Promise<IUser & { password: string } | null> {
        const result = await Db.Instance.collection(DB_COLLECTIONS.USERS).findOne({ email },
            {
                projection: {
                    _id: 1,
                    name: 1,
                    email: 1,
                    password: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            });
        return result as IUser & { password: string } | null;
    }
}