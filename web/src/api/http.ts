// src/api/http.ts
import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL;

export const http = axios.create({
  baseURL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((config) => {
  const method = (config.method ?? "get").toLowerCase();
  if (!["get", "head", "options"].includes(method)) {
    const token = localStorage.getItem("csrfToken");
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any)["x-csrf-token"] = token;
    }
  }
  return config;
});
