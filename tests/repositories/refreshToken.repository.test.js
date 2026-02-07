const { randomUUID } = require("crypto");

const refreshTokenRepo = require("../../src/repositories/refreshTokenRepository");
const prisma = require("../../src/config/prisma");

// resolve conexões penduradas, warning do jest e testes que nunca finalizam
beforeEach(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("RefreshTokenRepository", () => {
  it("deve criar um refresh token", async () => {
    const user = await prisma.user.create({
      data: {
        name: "John",
        email: "john@test.com",
        password: "123456",
      },
    });

    const token = await refreshTokenRepo.create({
      // jti único é obrigatório para unicidade e rotação
      token: "token123",
      jti: randomUUID(),
      userId: user.id,
      expiresAt: new Date(Date.now() + 10000),
    });

    expect(token).toHaveProperty("id");
    expect(token.token).toBe("token123");
  });

  it("não deve permitir token duplicado", async () => {
    const user = await prisma.user.create({
      data: {
        name: "John",
        email: "john@test.com",
        password: "123456",
      },
    });

    await refreshTokenRepo.create({
      token: "duplicado",
      jti: randomUUID(), // cada refresh precisa de jti diferente
      userId: user.id,
      expiresAt: new Date(Date.now() + 10000),
    });

    await expect(
      refreshTokenRepo.create({
        token: "duplicado",
        jti: randomUUID(),
        userId: user.id,
        expiresAt: new Date(Date.now() + 10000),
      }),
    ).rejects.toBeTruthy();
  });
});
