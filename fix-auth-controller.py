import os

file_path = "majestan-backend/src/modules/auth/auth.controller.ts"
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

bad_block = """  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('users/login')
  
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('user/phone')
  async phoneAuth(@Body() credentials: PhoneAuthDto) {
    return this.authService.phoneLoginOrRegister(credentials);
  }

  async loginUser(@Body() credentials: UserLoginDto) {
    return this.authService.loginUser(credentials);
  }"""

good_block = """  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('user/phone')
  async phoneAuth(@Body() credentials: PhoneAuthDto) {
    return this.authService.phoneLoginOrRegister(credentials);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('users/login')
  async loginUser(@Body() credentials: UserLoginDto) {
    return this.authService.loginUser(credentials);
  }"""

if bad_block in content:
    content = content.replace(bad_block, good_block)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("AuthController fixed.")
else:
    print("Bad block not found. Please review manually.")
