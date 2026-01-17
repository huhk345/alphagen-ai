
import { User } from "../types";

const SESSION_KEY = "alphagen_user_session";

declare const google: any;

export const loginWithGoogle = (): Promise<User> => {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const rawAllowed = process.env.VITE_ALLOWED_EMAILS || "";
  const allowedEmails = rawAllowed
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  return new Promise((resolve, reject) => {
    if (typeof google === "undefined") {
      return reject(new Error("Google SDK not loaded. Check script in index.html."));
    }

    if (!GOOGLE_CLIENT_ID) {
      console.error("GOOGLE_CLIENT_ID is missing in environment variables");
      return reject(new Error("Missing GOOGLE_CLIENT_ID. Please set it in your environment variables."));
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error !== undefined) {
            return reject(new Error(`Google Auth Error: ${tokenResponse.error_description || tokenResponse.error}`));
          }

          try {
            const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });
            const profile = await res.json();

            if (allowedEmails.length > 0) {
              const email = String(profile.email || "").toLowerCase();
              if (!allowedEmails.includes(email)) {
                return reject(
                  new Error("当前邮箱没有访问权限，请联系管理员将邮箱加入白名单。")
                );
              }
            }

            const user: User = {
              id: profile.sub,
              name: profile.name,
              email: profile.email,
              avatar: profile.picture,
              provider: "google",
              isLoggedIn: true,
              accessToken: tokenResponse.access_token,
            };

            import("./dbService").then((db) => db.saveUserToCloud(user));

            localStorage.setItem(SESSION_KEY, JSON.stringify(user));
            resolve(user);
          } catch (e: any) {
            reject(new Error(`Profile Fetch Failed: ${e.message}`));
          }
        },
      });

      client.requestAccessToken();
    } catch (e: any) {
      reject(new Error(`Google SDK Initialization Failed: ${e.message}`));
    }
  });
};

export const logout = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const getSession = (): User | null => {
  const session = localStorage.getItem(SESSION_KEY);
  return session ? JSON.parse(session) : null;
};

export const getAccessToken = (): string | null => {
  const user = getSession();
  return user?.accessToken || null;
};
