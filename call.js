// ============================================================
// Mecd Chat
// call.js
// المكالمات الصوتية
// ============================================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    addDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// Firebase
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyA8ZA5fcy1Tl3hZ7_5n91xVOw06syHPGyI",
    authDomain: "mecd-tools.firebaseapp.com",
    projectId: "mecd-tools",
    storageBucket: "mecd-tools.firebasestorage.app",
    messagingSenderId: "643005547408",
    appId: "1:643005547408:web:b1719060ec340dd0e0a915"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// ============================================================
// WebRTC
// ============================================================

const rtcConfig = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: "stun:stun1.l.google.com:19302"
        }
    ]
};


// ============================================================
// بدء المكالمة من chat.html
// ============================================================

export async function startCall({
    friendId,
    friendName = "مستخدم Mecd",
    friendPhoto = ""
}) {

    if (!auth.currentUser) {
        throw new Error("يجب تسجيل الدخول أولاً");
    }

    if (!friendId) {
        throw new Error("لم يتم تحديد الصديق");
    }

    const url =
        "./call.html?friend=" +
        encodeURIComponent(friendId) +
        "&name=" +
        encodeURIComponent(friendName) +
        "&photo=" +
        encodeURIComponent(friendPhoto);

    window.location.href = url;
}


// ============================================================
// استقبال المكالمة
// ============================================================

export function openIncomingCall(callId) {

    if (!callId) {
        return;
    }

    window.location.href =
        "./call.html?call=" +
        encodeURIComponent(callId);
}


// ============================================================
// أدوات عامة
// ============================================================

export function createVoiceCallId() {

    return doc(
        collection(
            db,
            "voiceCalls"
        )
    ).id;

}


// ============================================================
// الاستماع للمكالمات الواردة
// ============================================================

export function listenIncomingCalls(
    callback
) {

    const user = auth.currentUser;

    if (!user) {
        return () => {};
    }

    const userRef =
        doc(
            db,
            "users",
            user.uid
        );

    return onSnapshot(
        userRef,
        snapshot => {

            const data =
                snapshot.data();

            if (
                data &&
                data.incomingVoiceCall
            ) {

                callback(
                    data.incomingVoiceCall
                );

            }

        }
    );

}
