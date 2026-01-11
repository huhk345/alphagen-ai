
import { User } from "../types";

const SESSION_KEY = 'alphagen_user_session';

declare const google: any;

/**
 * Real Google Login using Implicit Flow (Token Client)
 */
export const loginWithGoogle = (): Promise<User> => {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

  return new Promise((resolve, reject) => {
    if (typeof google === 'undefined') {
      return reject(new Error('Google SDK not loaded. Check script in index.html.'));
    }

    if (!GOOGLE_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID is missing in environment variables');
      return reject(new Error('Missing GOOGLE_CLIENT_ID. Please set it in your environment variables.'));
    }

    console.log('Initializing Google Login with Client ID:', GOOGLE_CLIENT_ID);
    console.log('Current Origin:', window.location.origin);

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error !== undefined) {
            return reject(new Error(`Google Auth Error: ${tokenResponse.error_description || tokenResponse.error}`));
          }

          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });
            const profile = await res.json();
            
            const user: User = {
              id: profile.sub,
              name: profile.name,
              email: profile.email,
              avatar: profile.picture,
              provider: 'google',
              isLoggedIn: true
            };
            
            // Sync user profile to cloud
            import("./dbService").then(db => db.saveUserToCloud(user));
            
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
