import { AuthService } from './auth.service';

describe('OTP login for a legacy visitor account', () => {
  it('marks the phone verified before issuing the visitor session', async () => {
    const user = {
      id: 11,
      email: 'owner@example.test',
      phone: '+919876543210',
      name: 'Owner',
      role: 'user',
      is_verified: 0,
    };
    const query: any = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const signAsync = jest.fn().mockResolvedValue('session');
    const service = new AuthService(
      { createQueryBuilder: () => query } as any,
      { getOrThrow: () => '7d' } as any,
      { signAsync } as any,
    );
    const response = await service.loginUserWithPhone(user.phone);
    expect(query.set).toHaveBeenCalledWith({ isVerified: true });
    expect(query.where).toHaveBeenCalledWith('id = :id', { id: 11 });
    expect(response.user.isVerified).toBe(true);
    expect(signAsync).toHaveBeenCalled();
  });
});
