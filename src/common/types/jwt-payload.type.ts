import { AppRole } from '../enums/app-role.enum';

export type JwtPayload = {
  sub: number;
  username: string;
  role: AppRole;
};
