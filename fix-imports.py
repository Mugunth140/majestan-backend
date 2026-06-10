import os

file_path = "majestan-backend/src/modules/auth/auth.service.ts"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith("import { PhoneAuthDto }"):
        new_lines.append("import { PhoneAuthDto } from './dto/phone-auth.dto';\n")
        new_lines.append("import { User } from '../../database/entities/user.entity';\n")
    else:
        new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
