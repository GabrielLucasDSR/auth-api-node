const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AppError = require("../../src/errors/AppError");
const userRepository = require("../../src/repositories/userRepository");
const refreshTokenRepository = require("../../src/repositories/refreshTokenRepository");

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

jest.mock("../../src/repositories/userRepository", () => ({
  findByEmail: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../../src/repositories/refreshTokenRepository", () => ({
  create: jest.fn(),
  findByToken: jest.fn(),
  revoke: jest.fn(),
}));

const authService = require("../../src/services/authService");

describe("AuthService (unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("throws USER_ALREADY_EXISTS when email already exists", async () => {
      userRepository.findByEmail.mockResolvedValue({ id: 1 });

      await expect(
        authService.register({
          name: "John",
          email: "john@test.com",
          password: "123456",
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: "USER_ALREADY_EXISTS",
      });
    });

    it("creates user with normalized email and hashed password", async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashed-pass");
      userRepository.create.mockResolvedValue({
        id: 1,
        name: "John",
        email: "john@test.com",
        password: "hashed-pass",
      });

      const result = await authService.register({
        name: "John",
        email: "  John@Test.com  ",
        password: "123456",
      });

      expect(userRepository.findByEmail).toHaveBeenCalledWith("john@test.com");
      expect(bcrypt.hash).toHaveBeenCalledWith("123456", 8);
      expect(userRepository.create).toHaveBeenCalledWith({
        name: "John",
        email: "john@test.com",
        password: "hashed-pass",
      });
      expect(result).toEqual({
        id: 1,
        name: "John",
        email: "john@test.com",
      });
    });
  });

  describe("login", () => {
    it("throws INVALID_CREDENTIALS when user does not exist", async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: "john@test.com", password: "123456" }),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
      });
    });

    it("throws INVALID_CREDENTIALS when password is invalid", async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 1,
        email: "john@test.com",
        password: "hashed",
      });
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        authService.login({ email: "john@test.com", password: "wrong" }),
      ).rejects.toMatchObject({
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
      });
    });

    it("returns access and refresh tokens and persists refresh token", async () => {
      userRepository.findByEmail.mockResolvedValue({
        id: 1,
        email: "john@test.com",
        password: "hashed",
      });
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign
        .mockReturnValueOnce("access-token")
        .mockReturnValueOnce("refresh-token");
      refreshTokenRepository.create.mockResolvedValue({ id: "rt-1" });

      const result = await authService.login({
        email: "john@test.com",
        password: "123456",
      });

      expect(result).toEqual({
        token: "access-token",
        refreshToken: "refresh-token",
      });

      expect(refreshTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "refresh-token",
          jti: expect.any(String),
          userId: 1,
          expiresAt: expect.any(Date),
        }),
      );
    });
  });

  describe("refreshToken", () => {
    it("throws INVALID_REFRESH_TOKEN when token is missing", async () => {
      await expect(authService.refreshToken("")).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_REFRESH_TOKEN",
      });
    });

    it("throws INVALID_REFRESH_TOKEN when token does not exist in DB", async () => {
      refreshTokenRepository.findByToken.mockResolvedValue(null);

      await expect(authService.refreshToken("rt")).rejects.toMatchObject({
        statusCode: 401,
        code: "INVALID_REFRESH_TOKEN",
      });
    });

    it("throws INVALID_REFRESH_TOKEN when token is revoked", async () => {
      refreshTokenRepository.findByToken.mockResolvedValue({
        token: "rt",
        jti: "jti-1",
        revoked: true,
        expiresAt: new Date(Date.now() + 60_000),
      });
      jwt.verify.mockReturnValue({ id: 1, jti: "jti-1" });

      await expect(authService.refreshToken("rt")).rejects.toMatchObject({
        statusCode: 401,
        code: "INVALID_REFRESH_TOKEN",
      });
    });

    it("throws INVALID_REFRESH_TOKEN when jti does not match", async () => {
      refreshTokenRepository.findByToken.mockResolvedValue({
        token: "rt",
        jti: "jti-db",
        revoked: false,
        expiresAt: new Date(Date.now() + 60_000),
      });
      jwt.verify.mockReturnValue({ id: 1, jti: "jti-jwt" });

      await expect(authService.refreshToken("rt")).rejects.toMatchObject({
        statusCode: 401,
        code: "INVALID_REFRESH_TOKEN",
      });
    });

    it("rotates refresh token and returns new token pair", async () => {
      refreshTokenRepository.findByToken.mockResolvedValue({
        token: "old-rt",
        jti: "jti-1",
        revoked: false,
        expiresAt: new Date(Date.now() + 60_000),
      });
      jwt.verify.mockReturnValue({ id: 1, jti: "jti-1" });
      jwt.sign
        .mockReturnValueOnce("new-access")
        .mockReturnValueOnce("new-refresh");

      const result = await authService.refreshToken("old-rt");

      expect(refreshTokenRepository.revoke).toHaveBeenCalledWith("old-rt");
      expect(refreshTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "new-refresh",
          jti: expect.any(String),
          userId: 1,
          expiresAt: expect.any(Date),
        }),
      );
      expect(result).toEqual({
        token: "new-access",
        refreshToken: "new-refresh",
      });
    });
  });

  describe("logout", () => {
    it("throws INVALID_REFRESH_TOKEN when token is missing", async () => {
      await expect(authService.logout("")).rejects.toMatchObject({
        statusCode: 400,
        code: "INVALID_REFRESH_TOKEN",
      });
    });

    it("throws INVALID_REFRESH_TOKEN when token does not exist", async () => {
      refreshTokenRepository.findByToken.mockResolvedValue(null);

      await expect(authService.logout("rt")).rejects.toMatchObject({
        statusCode: 401,
        code: "INVALID_REFRESH_TOKEN",
      });
    });

    it("revokes token when token exists", async () => {
      refreshTokenRepository.findByToken.mockResolvedValue({ token: "rt" });
      refreshTokenRepository.revoke.mockResolvedValue({ count: 1 });

      await authService.logout("rt");

      expect(refreshTokenRepository.revoke).toHaveBeenCalledWith("rt");
    });
  });
});
