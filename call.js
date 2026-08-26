/* =========================================
   Mecd Chat - Call System
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

const auth =
    getAuth(firebaseApp);

const db =
    getFirestore(firebaseApp);


/* =========================================
   المستخدم الحالي
   ========================================= */

let currentUser = null;

onAuthStateChanged(
    auth,
    user => {

        currentUser = user;

    }
);


/* =========================================
   إنشاء ID للمكالمة
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
   بدء الاتصال
   ========================================= */

export async function startCall({

    friendId,
    friendName,
    friendPhoto

}) {

    if (!currentUser) {

        alert(
            "⚠️ يجب تسجيل الدخول أولاً"
        );

        return;

    }


    if (!friendId) {

        alert(
            "⚠️ لم يتم تحديد الصديق"
        );

        return;

    }


    if (friendId === currentUser.uid) {

        alert(
            "⚠️ لا يمكنك الاتصال بنفسك"
        );

        return;

    }


    try {

        /* =========================
           إنشاء Call ID
        ========================= */

        const callId =
            createCallID();


        /* =========================
           بيانات المكالمة
        ========================= */

        const callData = {

            callId: callId,

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


        /* =========================
           حفظ المكالمة في Firestore
        ========================= */

        await setDoc(

            doc(
                db,
                "calls",
                callId
            ),

            callData

        );


        /* =========================
           فتح شاشة الاتصال
        ========================= */

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
   مراقبة المكالمات الواردة
   ========================================= */

export function listenIncomingCalls() {

    if (!currentUser) {
        return;
    }


    const userCallRef =
        doc(
            db,
            "users",
            currentUser.uid
        );


    return onSnapshot(

        userCallRef,

        async snapshot => {

            if (!snapshot.exists()) {
                return;
            }


            const data =
                snapshot.data();


            const incomingCall =
                data.incomingCall;


            if (!incomingCall) {
                return;
            }


            if (
                incomingCall.receiverId !==
                currentUser.uid
            ) {

                return;

            }


            if (
                incomingCall.status !==
                "ringing"
            ) {

                return;

            }


            /* منع فتح نفس المكالمة أكثر من مرة */

            if (
                window.currentIncomingCallId ===
                incomingCall.callId
            ) {

                return;

            }


            window.currentIncomingCallId =
                incomingCall.callId;


            const params =
                new URLSearchParams();


            params.set(
                "callId",
                incomingCall.callId
            );


            params.set(
                "mode",
                "incoming"
            );


            window.location.href =
                "call.html?" +
                params.toString();

        }

    );

}


/* =========================================
   إرسال المكالمة الواردة للمستخدم
   ========================================= */

export async function notifyIncomingCall({

    receiverId,
    callId,
    callerId,
    callerName,
    callerPhoto

}) {

    if (!receiverId || !callId) {
        return;
    }


    await setDoc(

        doc(
            db,
            "users",
            receiverId
        ),

        {

            incomingCall: {

                callId:
                    callId,

                callerId:
                    callerId,

                callerName:
                    callerName ||
                    "مستخدم Mecd",

                callerPhoto:
                    callerPhoto ||
                    "",

                receiverId:
                    receiverId,

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
   حذف طلب المكالمة الواردة
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
   الحصول على بيانات المكالمة
   ========================================= */

export async function getCall
