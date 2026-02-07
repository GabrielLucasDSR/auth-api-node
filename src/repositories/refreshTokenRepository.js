const prisma = require("../config/prisma");

class RefreshTokenRepository {
  async create({ token, userId, expiresAt }) {
    return prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });
  }

  async findByToken(token) {
    return prisma.refreshToken.findUnique({
      where: { token },
    });
  }

  async delete(token) {
    return prisma.refreshToken.deleteMany({
      where: { token },
    });
  }
}

module.exports = new RefreshTokenRepository();
