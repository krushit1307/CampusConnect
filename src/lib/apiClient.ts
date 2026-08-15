import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { fingerprintService } from "./fingerprint";
import { triggerSessionRecovery, enqueueFailedRequest } from "./sessionRecovery";

export interface CustomInternalAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * Secure API Client
 * Extends Axios to automatically inject X-Device-Fingerprint headers and handle
 * 401 Session Recovery via in-place LoginRecoveryModal.
 */
class SecureApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        // Only attach fingerprint to sensitive endpoints to respect privacy
        const sensitiveEndpoints = ["/auth/login", "/auth/signup", "/tickets/purchase"];
        const isSensitive = sensitiveEndpoints.some((endpoint) => config.url?.includes(endpoint));

        if (isSensitive) {
          try {
            const visitorId = await fingerprintService.getVisitorId();
            if (visitorId) {
              config.headers["X-Device-Fingerprint"] = visitorId;
            }
          } catch (error) {
            console.warn("Failed to attach device fingerprint to request:", error);
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config as CustomInternalAxiosRequestConfig;

        if (error.response?.status === 429) {
          console.warn("Rate limit exceeded. Device may be shadow-banned.");
        }

        // Intercept 401 Unauthorized for In-Place Session Recovery
        // Exclude login endpoint itself to prevent loops when credentials fail
        const isLoginRequest = originalRequest?.url?.includes("/auth/login");

        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retry &&
          !isLoginRequest
        ) {
          originalRequest._retry = true;

          // Open recovery modal ONCE (handles parallel 401 requests via lock state)
          triggerSessionRecovery();

          try {
            // Pause promise execution until user re-authenticates in LoginRecoveryModal
            const newToken = await enqueueFailedRequest();

            if (originalRequest.headers) {
              originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
            }

            // Automatically re-fire the exact same intercepted Axios request with fresh JWT
            return this.client(originalRequest);
          } catch (recoveryError) {
            return Promise.reject(recoveryError);
          }
        }

        return Promise.reject(error);
      },
    );
  }

  public getClient(): AxiosInstance {
    return this.client;
  }
}

export const apiClient = new SecureApiClient().getClient();
