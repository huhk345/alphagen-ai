
import { User } from "../types";

const SESSION_KEY = "alphagen_user_session";
const STATE_KEY = "github_oauth_state";

const getBackendBaseUrl = (): string => {
  const apiBase = process.env.VITE_API_URL || "http://localhost:3001/api";
  return apiBase.replace(/\/api\/?$/, "");
};

export const startGithubLogin = (): void => {
  const clientId = process.env.VITE_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error("缺少 GitHub Client ID，请在环境变量中配置 VITE_GITHUB_CLIENT_ID。");
  }

  const redirectUri = `${window.location.origin}${window.location.pathname}?github_callback=1`;
  const state =
    (typeof crypto !== "undefined" && "randomUUID" in crypto && crypto.randomUUID()) ||
    Math.random().toString(36).slice(2);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
  });

  window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
};

export const completeGithubLogin = async (): Promise<User | null> => {
  const url = new URL(window.location.href);
  const callbackFlag = url.searchParams.get("github_callback");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (callbackFlag !== "1" || !code) {
    return null;
  }

  const storedState = sessionStorage.getItem(STATE_KEY);
  if (storedState && state && storedState !== state) {
    sessionStorage.removeItem(STATE_KEY);
    throw new Error("GitHub 登录状态校验失败，请重试。");
  }
  sessionStorage.removeItem(STATE_KEY);

  const redirectUri = `${window.location.origin}${window.location.pathname}?github_callback=1`;
  const backendBase = getBackendBaseUrl();

  const resp = await fetch(`${backendBase}/auth/github/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    const message = (data && (data.detail || data.error)) || "GitHub 登录失败，请稍后重试。";
    throw new Error(message);
  }

  const user = (await resp.json()) as User;

  const rawAllowed = process.env.VITE_ALLOWED_EMAILS || "";
  const allowedEmails = rawAllowed
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (allowedEmails.length > 0) {
    const email = String(user.email || "").toLowerCase();
    if (!allowedEmails.includes(email)) {
      throw new Error("当前 GitHub 邮箱没有访问权限，请联系管理员将邮箱加入白名单。");
    }
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));

  return user;
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
