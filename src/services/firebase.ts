type LocalAuthShim = {
    currentUser: {
        uid: string;
    } | null;
};

const app = null;
const analytics = null;
const auth: LocalAuthShim = {
    currentUser: {
        uid: 'local-desktop-user'
    }
};
export const db = null;
const googleProvider = null;
export const isFirebaseEnabled = false;
