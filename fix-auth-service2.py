import os
import re

file_path = "majestan-backend/src/modules/auth/auth.service.ts"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add User import
if "import { User }" not in content:
    content = content.replace("import { PhoneAuthDto }", "import { PhoneAuthDto }\nimport { User } from '../../database/entities/user.entity';")

# Fix phoneLoginOrRegister
old_phone_method = """  async phoneLoginOrRegister(credentials: PhoneAuthDto) {
    let user = await this.getAppUserByPhone(credentials.phone);

    if (!user) {
      // Auto-register
      const email = `${credentials.phone}@user.majestan.local`;
      const dummyPassword = await hash(Math.random().toString(36).slice(-10), 10);
      
      const result = await this.dataSource
        .createQueryBuilder()
        .insert()
        .into('users')
        .values({
          name: 'Majestan User',
          email,
          phone: credentials.phone,
          password_hash: dummyPassword,
          role: 'user',
          is_verified: true,
        })
        .execute();"""

new_phone_method = """  async phoneLoginOrRegister(credentials: PhoneAuthDto) {
    const fullPhone = `${credentials.countryCode}${credentials.phone}`;
    let user = await this.getAppUserByPhone(fullPhone);

    if (!user) {
      // Auto-register
      const email = credentials.email || `${fullPhone}@user.majestan.local`;
      const name = credentials.name || 'Majestan User';
      const dummyPassword = await hash(Math.random().toString(36).slice(-10), 10);
      
      const result = await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          name: name,
          email: email,
          phone: fullPhone,
          passwordHash: dummyPassword,
          role: AppRole.User as any,
          isVerified: true,
        })
        .execute();"""

if old_phone_method in content:
    content = content.replace(old_phone_method, new_phone_method)

# Fix registerUser
old_register_method = """    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into('users')
      .values({
        name: payload.name.trim(),
        email,
        phone: payload.phone.trim(),
        password_hash: passwordHash,
        role: AppRole.User,
        is_verified: false,
      })
      .execute();"""

new_register_method = """    const result = await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(User)
      .values({
        name: payload.name.trim(),
        email,
        phone: payload.phone.trim(),
        passwordHash: passwordHash,
        role: AppRole.User as any,
        isVerified: false,
      })
      .execute();"""

if old_register_method in content:
    content = content.replace(old_register_method, new_register_method)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("AuthService fixed.")
