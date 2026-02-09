const prisma = require("../config/prisma");

class RefreshTokenRepository {
  async create({ tokenHash, jti, userId, expiresAt }) {
    return prisma.refreshToken.create({
      data: { tokenHash, jti, userId, expiresAt },
    });
  }

  async findByJti(jti) {
    return prisma.refreshToken.findUnique({
      where: { jti },
    });
  }

  async revokeByJti(jti) {
    return prisma.refreshToken.updateMany({
      where: { jti },
      data: { revoked: true },
    });
  }
}

module.exports = new RefreshTokenRepository();
