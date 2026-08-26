/* =========================================
   Mecd Chat - Real Call System
   WebRTC + Firestore
   ========================================= */

import {
    getApps,
    getApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =========================================
   Firebase
   ========================================= */

const firebaseApp =
    getApps().length
        ? getApp()
        : null;

if (!firebaseApp) {
    throw new Error(
        "Firebase لم يتم تشغيله قبل تحميل call.js"
    );
}

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);


/* =========================================
   المستخدم
   ========================================= */

let currentUser = null;

onAuthStateChanged(auth, user => {
    currentUser = user;
});


/* =========================================
   إنشاء Call ID
   ========================================= */

function createCallID() {

    return (
        Date.now().toString(36) +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 10)
    );

}


/* =========================================
   بدء المكالمة
   ========================================= */

export async function startCall({
    friendId,
    friendName,
    friendPhoto
}) {

    if (!currentUser) {

        alert("⚠️ يجب تسجيل الدخول أولاً");
        return;

    }

    if (!friendId) {

        alert("⚠️ لم يتم تحديد الصديق");
        return;

    }

    if (friendId === currentUser.uid) {

        alert("⚠️ لا يمكنك الاتصال بنفسك");
        return;

    }


    try {

        const callId = createCallID();


        const callData = {

            callId,

            callerId:
                currentUser.uid,

            receiverId:
                friendId,

            callerName:
                currentUser.displayName ||
                "مستخدم Mecd",

            callerPhoto:
                currentUser.photoURL ||
                "",

            receiverName:
                friendName ||
                "مستخدم Mecd",

            receiverPhoto:
                friendPhoto ||
                "",

            type:
                "audio",

            status:
                "ringing",

            createdAt:
                serverTimestamp()

        };


        /* إنشاء المكالمة */

        await setDoc(
            doc(db, "calls", callId),
            callData
        );


        /* إرسال إشعار للطرف الثاني */

        await setDoc(

            doc(
                db,
                "users",
                friendId
            ),

            {

                incomingCall: {

                    callId,

                    callerId:
                        currentUser.uid,

                    callerName:
                        currentUser.displayName ||
                        "مستخدم Mecd",

                    callerPhoto:
                        currentUser.photoURL ||
                        "",

                    receiverId:
                        friendId,

                    status:
                        "ringing",

                    createdAt:
                        serverTimestamp()

                }

            },

            {
                merge: true
            }

        );


        /* فتح شاشة المكالمة */

        const params =
            new URLSearchParams();

        params.set(
            "callId",
            callId
        );

        params.set(
            "mode",
            "outgoing"
        );

        window.location.href =
            "call.html?" +
            params.toString();


    } catch (error) {

        console.error(
            "Start call error:",
            error
        );

        alert(
            "❌ تعذر بدء المكالمة"
        );

    }

}


/* =========================================
   المكالمات الواردة
   ========================================= */

export function listenIncomingCalls() {

    if (!currentUser) {
        return;
    }


    const userRef =
        doc(
            db,
            "users",
            currentUser.uid
        );


    return onSnapshot(

        userRef,

        snapshot => {

            if (!snapshot.exists()) {
                return;
            }


            const data =
                snapshot.data();


            const incoming =
                data.incomingCall;


            if (!incoming) {
                return;
            }


            if (
                incoming.receiverId !==
                currentUser.uid
            ) {
                return;
            }


            if (
                incoming.status !==
                "ringing"
            ) {
                return;
            }


            if (
                window.currentIncomingCallId ===
                incoming.callId
            ) {
                return;
            }


            window.currentIncomingCallId =
                incoming.callId;


            const params =
                new URLSearchParams();


            params.set(
                "callId",
                incoming.callId
            );

            params.set(
                "mode",
                "incoming"
            );

            params.set(
                "name",
                incoming.callerName ||
                "مستخدم Mecd"
            );

            params.set(
                "photo",
                incoming.callerPhoto ||
                ""
            );


            window.location.href =
                "call.html?" +
                params.toString();

        },

        error => {

            console.error(
                "Incoming call error:",
                error
            );

        }

    );

}


/* =========================================
   إنهاء المكالمة
   ========================================= */

export async function endCall(callId) {

    if (!callId) {
        return;
    }


    try {

        await updateDoc(

            doc(
                db,
                "calls",
                callId
            ),

            {

                status:
                    "ended",

                endedAt:
                    serverTimestamp()

            }

        );

    } catch (error) {

        console.error(
            "End call error:",
            error
        );

    }

}


/* =========================================
   حذف المكالمة الواردة
   ========================================= */

export async function clearIncomingCall() {

    if (!currentUser) {
        return;
    }


    try {

        await updateDoc(

            doc(
                db,
                "users",
                currentUser.uid
            ),

            {

                incomingCall:
                    null

            }

        );

    } catch (error) {

        console.error(
            "Clear incoming call error:",
            error
        );

    }

}


/* =========================================
   الحصول على المكالمة
   ========================================= */

export async function getCall(callId) {

    if (!callId) {
        return null;
    }


    const snapshot =
        await getDoc(

            doc(
                db,
                "calls",
                callId
            )

        );


    if (!snapshot.exists()) {
        return null;
    }


    return {
        id: snapshot.id,
        ...snapshot.data()
    };

}
