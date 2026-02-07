const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const authConfig = require("../config/auth");
const userRepository = require("../repositories/userRepository");
const refreshTokenRepository = require("../repositories/refreshTokenRepository");
const AppError = require("../errors/AppError"); 

const HASH_ROUNDS = 8;
const ACCESS_TOKEN_EXPIRES_IN = authConfig.jwt.expiresIn;
const REFRESH_TOKEN_EXPIRES_IN = "7d";

/**
 * Service de autenticação
 * - Normaliza email
 * - Gera access/refresh tokens
 * - Mantém refresh tokens versionados e revogáveis no banco
 */
const normalizeEmail = (email) => email.trim().toLowerCase();

class AuthService {
  async register({ name, email, password }) {
    const normalizedEmail = normalizeEmail(email);

    const existingUser = await userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError("user already exists", 409, "USER_ALREADY_EXISTS");
    }

    const hashedPassword = await bcrypt.hash(password, HASH_ROUNDS);

    const user = await userRepository.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
    });

    const { password: _, ...rest } = user;
    return rest;
  }

  async login({ email, password }) {
    const normalizedEmail = normalizeEmail(email);

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      throw new AppError("user not found", 401, "INVALID_CREDENTIALS");
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new AppError("invalid password", 401, "INVALID_CREDENTIALS");
    }

    const token = jwt.sign({ id: user.id }, authConfig.jwt.secret, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    // Refresh token com jti único para permitir rotação e revogação
    const refreshJti = randomUUID();
    const refreshToken = jwt.sign(
      { id: user.id, jti: refreshJti },
      authConfig.jwt.secret,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN },
    );

    await refreshTokenRepository.create({
      token: refreshToken,
      jti: refreshJti,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { token, refreshToken };
  }

  async refreshToken(token) {
    if (!token) {
      throw new AppError("invalid refresh token", 400, "INVALID_REFRESH_TOKEN");
    }

    const storedToken = await refreshTokenRepository.findByToken(token);
    if (!storedToken) {
      throw new AppError("invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
    }

    let decoded;
    try {
      decoded = jwt.verify(token, authConfig.jwt.secret);
    } catch {
      throw new AppError("invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
    }

    // Garante que o estado no banco prevalece sobre o JWT assinado
    if (storedToken.revoked)
      throw new AppError("invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
    if (storedToken.expiresAt <= new Date())
      throw new AppError("invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
    if (decoded.jti !== storedToken.jti)
      throw new AppError("invalid refresh token", 401, "INVALID_REFRESH_TOKEN");

    // Rotação: revoga o usado e emite novo par
    await refreshTokenRepository.revoke(token);

    const newAccessToken = jwt.sign({ id: decoded.id }, authConfig.jwt.secret, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    const newRefreshJti = randomUUID();
    const newRefreshToken = jwt.sign(
      { id: decoded.id, jti: newRefreshJti },
      authConfig.jwt.secret,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN },
    );

    await refreshTokenRepository.create({
      token: newRefreshToken,
      jti: newRefreshJti,
      userId: decoded.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { token: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(token) {
    if (!token) {
      throw new AppError("invalid refresh token", 400, "INVALID_REFRESH_TOKEN");
    }

    const storedToken = await refreshTokenRepository.findByToken(token);
    if (!storedToken) {
      throw new AppError("invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
    }

    // Revoga o refresh token para impedir reuso
    await refreshTokenRepository.revoke(token);
  }
}

module.exports = new AuthService();
