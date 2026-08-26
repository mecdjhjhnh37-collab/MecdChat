import {
    initializeApp,
    getApps,
    getApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA8ZA5fcy1Tl3hZ7_5n91xVOw06syHPGyI",
    authDomain: "mecd-tools.firebaseapp.com",
    projectId: "mecd-tools",
    storageBucket: "mecd-tools.firebasestorage.app",
    messagingSenderId: "643005547408",
    appId: "1:643005547408:web:b1719060ec340dd0e0a915"
};



const app =
    getApps().length
        ? getApp()
        : initializeApp(firebaseConfig);


const auth =
    getAuth(app);

const db =
    getFirestore(app);


export {
    app,
    auth,
    db
};
