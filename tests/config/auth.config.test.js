describe("auth config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("throws on startup when JWT_SECRET is missing", () => {
    delete process.env.JWT_SECRET;

    expect(() => {
      jest.isolateModules(() => {
        require("../../src/config/auth");
      });
    }).toThrow("JWT_SECRET is required");
  });

  it("loads config when JWT_SECRET is present", () => {
    process.env.JWT_SECRET = "test-secret";

    let authConfig;
    jest.isolateModules(() => {
      authConfig = require("../../src/config/auth");
    });

    expect(authConfig.jwt.secret).toBe("test-secret");
    expect(authConfig.jwt.expiresIn).toBeDefined();
  });
});
