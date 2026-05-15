import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mindtrace.app",
  appName: "思迹",
  webDir: ".next",
  server: {
    url: "https://mindtrace-556w.onrender.com",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
    preferredContentMode: "mobile",
  },
};

export default config;
