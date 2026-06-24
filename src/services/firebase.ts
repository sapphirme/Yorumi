type LocalAuthShim = {
    currentUser: {
        uid: string;
    } | null;
};

export const app = null;
export const analytics = null;
export const auth: LocalAuthShim = {
    currentUser: {
        uid: 'local-desktop-user'
    }
};
export const db = null;
export const googleProvider = null;
export const isFirebaseEnabled = false;
