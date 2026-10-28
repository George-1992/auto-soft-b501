import { GLOBALS } from "@/globals"
import { sendBackRequest } from "@/src/services/backend";
import { setCookie } from "@/src/services/cookies";
import db from "@/src/services/db";
import { logger } from "@/src/services/logger";

export const auth = async () => {
    let resObj = {
        success: false,
        message: "Authentication failed",
        data: null,
    };
    try {
        // logger.info("auth: Checking authentication status");
        const _profile = await db.all.where('itsFor').equals('signin').toArray();
        const profile = _profile?.[0] || null;
        // const profileData = await db.all.toArray();
        // logger.info("auth: profile", profile);

        if (profile) {
            resObj.success = true;
            resObj.message = "Authentication successful";
            resObj.data = profile;
        } else {
            resObj.success = false;
            resObj.message = "No profile data found";
            resObj.data = null;
        }
      

    } catch (error) {
        logger.error("auth: Error during authentication", error);
        resObj.success = false;
        resObj.message = error.message;
        resObj.data = error;
    }

    // console.log('>>>auth: resObj:', resObj);
    return resObj;
}



const decodePayload = (token) => {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
};
export const verifyToken = async (token) => {
    let resObj = {
        success: false,
        message: "Token verification failed",
        data: null,
    };
    try {
        if (!token) {
            resObj.message = "No token";
            return resObj;
        }

        const payload = decodePayload(token);

        if (payload.exp && payload.exp * 1000 <= Date.now()) {
            resObj.message = "Token expired";
            return resObj;
        }

        resObj.success = true;
        resObj.message = "Token verification successful";
        resObj.data = { token, payload };
    } catch (error) {
        resObj.success = false;
        resObj.message = "Invalid token";
        resObj.data = error;
    }
    return resObj;
};
export const handleSignin = async (props) => {

    // const dummyUserData = {
    //     userId: 123,
    //     name: "John Doe",
    //     email: "john.doe@example.com",
    //     token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwibGV2ZWwiOiJhZG1pbiIsImVtYWlsIjoiam9obi5kb2VAZXhhbXBsZS5jb20iLCJpYXQiOjE3OTEwMjkyODYsImV4cCI6MTc5MjA0OTI4Nn0.wxYwRHgLRDl7URItj08VIk3JoT162MYGPnW_SUgsRZc"
    // };
    let resObj = {
        success: false,
        message: "Signin failed",
        data: null
    };


    try {

        // set cookie with token
        const AUTH_COOKIE_NAME = GLOBALS.AUTH_COOKIE_NAME || "auth_token";
        // const token = dummyUserData.token;

        const result = await sendBackRequest({
            itsFor: 'signin',
            // action: 'create',
            // method: 'POST',
            data: props,
        })

        if (!result.success) {
            resObj = result;
            return resObj;
        }

        const token = result?.token;
        const verifyRes = await verifyToken(token);

        // logger.info("handleSignin: verifyRes", verifyRes);
        if (!verifyRes.success) {
            resObj.success = false;
            resObj.message = verifyRes.message || "Token verification failed";
            resObj.data = verifyRes.data || null;
            return resObj;
        }
        // logger.info("handleSignin: Token verified successfully", verifyRes);

        // const { exp } = verifyRes.data.payload;
        // const expires = exp
        //     ? new Date(exp * 1000)
        //     : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // setCookie(AUTH_COOKIE_NAME, token, { path: '/', expires });
        resObj = result;

        // resObj.success = true;
        // resObj.message = "Signin successful";
        // resObj.data = verifyRes.data.payload || null;

        return resObj;
    } catch (error) {
        resObj.success = false;
        resObj.message = error.message;
        resObj.data = error;
        return resObj;
    }
};
export const handleSignout = async () => {
    let resObj = {
        success: true,
        message: "Signout successful",
        data: null
    };
    try {
        // const AUTH_COOKIE_NAME = GLOBALS.AUTH_COOKIE_NAME || "auth_token";
        // setCookie(AUTH_COOKIE_NAME, "", { path: '/', expires: new Date(0) });

        // delete signin data from local db
        await db.all.where('itsFor').equals('signin').delete();

        await sendBackRequest({
            itsFor: 'signout',
            // action: 'delete',
            // method: 'POST',
        });
 
        // react-router redirect() only works in loaders/actions. For regular async calls,
        // force browser navigation to ensure the user is moved to signin.
        // if (typeof window !== 'undefined') {
        //     window.location.replace('/auth/signin');
        // }

        return resObj;
    }
    catch (error) {
        resObj.success = false;
        resObj.message = error.message;
        resObj.data = error;
        return resObj;
    }
};

export const handleSignup = async (data) => {
    let resObj = {
        success: false,
        message: "Signup failed",
        data: null,
        status: 'unknown',
        alerts: [],
    };
    try {
        const response = await sendBackRequest({
            itsFor: 'signup',
            // action: 'create',
            // method: 'POST',
            data: data,
        })

        // logger.info("handleSignup: response", response);
        return response;

    } catch (error) {
        resObj.success = false;
        resObj.message = error.message || 'Unknown error';
        resObj.status = error.status || 'error';
        return resObj;
    }
}

