const prisma = require("../config/prisma");

class RefreshTokenRepository {
  async create({ token, jti, userId, expiresAt }) {
    return prisma.refreshToken.create({
      data: { token, jti, userId, expiresAt },
    });
  }

  async findByToken(token) {
    return prisma.refreshToken.findUnique({ where: { token } });
  }

  async revoke(token) {
    return prisma.refreshToken.updateMany({
      where: { token },
      data: { revoked: true },
    });
  }
}

module.exports = new RefreshTokenRepository();
