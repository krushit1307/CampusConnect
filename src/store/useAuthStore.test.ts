import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";
import { useAuthStore } from "./useAuthStore";
import { mockUser } from "@/mocks/handlers";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  useAuthStore.getState().reset();
});
afterAll(() => server.close());

describe("useAuthStore with MSW", () => {
  it("starts in idle state with null user", () => {
    const state = useAuthStore.getState();
    expect(state.status).toBe("idle");
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeNull();
  });

  describe("login action", () => {
    it("transitions state: idle -> loading -> success on valid credentials", async () => {
      const store = useAuthStore.getState();

      const loginPromise = store.login("alex@campusconnect.edu", "secret-password");

      // Verify immediate transition to loading
      expect(useAuthStore.getState().status).toBe("loading");
      expect(useAuthStore.getState().error).toBeNull();

      await loginPromise;

      const stateAfter = useAuthStore.getState();
      expect(stateAfter.status).toBe("success");
      expect(stateAfter.user).toEqual({
        ...mockUser,
        email: "alex@campusconnect.edu",
      });
      expect(stateAfter.isAuthenticated).toBe(true);
      expect(stateAfter.error).toBeNull();
    });

    it("transitions state: idle -> loading -> error on invalid credentials", async () => {
      const store = useAuthStore.getState();

      const loginPromise = store.login("alex@campusconnect.edu", "invalid-password");

      expect(useAuthStore.getState().status).toBe("loading");

      await loginPromise;

      const stateAfter = useAuthStore.getState();
      expect(stateAfter.status).toBe("error");
      expect(stateAfter.user).toBeNull();
      expect(stateAfter.isAuthenticated).toBe(false);
      expect(stateAfter.error).toBe("Invalid email or password");
    });

    it("handles 500 server errors gracefully", async () => {
      server.use(
        http.post("/api/auth/login", () => {
          return HttpResponse.json({ error: "Internal Server Error" }, { status: 500 });
        }),
      );

      const store = useAuthStore.getState();
      await store.login("test@campusconnect.edu", "password");

      const state = useAuthStore.getState();
      expect(state.status).toBe("error");
      expect(state.error).toBe("Internal Server Error");
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("logout action", () => {
    it("resets user state to unauthenticated after logout", async () => {
      // First populate state via login
      await useAuthStore.getState().login("alex@campusconnect.edu", "password");
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      const logoutPromise = useAuthStore.getState().logout();
      expect(useAuthStore.getState().status).toBe("loading");

      await logoutPromise;

      const stateAfter = useAuthStore.getState();
      expect(stateAfter.status).toBe("idle");
      expect(stateAfter.user).toBeNull();
      expect(stateAfter.isAuthenticated).toBe(false);
    });
  });

  describe("fetchCurrentUser action", () => {
    it("fetches user successfully when authorized", async () => {
      await useAuthStore.getState().fetchCurrentUser("valid-auth-token");

      const state = useAuthStore.getState();
      expect(state.status).toBe("success");
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it("handles 401 unauthenticated response", async () => {
      await useAuthStore.getState().fetchCurrentUser("unauthenticated");

      const state = useAuthStore.getState();
      expect(state.status).toBe("error");
      expect(state.user).toBeNull();
      expect(state.error).toBe("Unauthorized");
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("reset action", () => {
    it("resets store state to initial defaults", async () => {
      await useAuthStore.getState().login("alex@campusconnect.edu", "password");
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      useAuthStore.getState().reset();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });
});
