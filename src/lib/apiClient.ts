import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { fingerprintService } from "./fingerprint";

/**
 * Secure API Client
 * Extends Axios to automatically inject the X-Device-Fingerprint header
 * into all critical requests (Login, Signup, Ticket Purchase).
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
      (error) => {
        if (error.response?.status === 429) {
          console.warn("Rate limit exceeded. Device may be shadow-banned.");
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
