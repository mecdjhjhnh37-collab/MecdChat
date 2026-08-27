/* =========================================
   Mecd Chat
   Real Voice Call
   WebRTC + Firestore
   Firebase v10.12.2
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
    serverTimestamp,
    collection,
    addDoc
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

let authReadyResolve;

let authReady = new Promise(resolve => {
    authReadyResolve = resolve;
});

let authResolved = false;

onAuthStateChanged(auth, user => {

    currentUser = user;

    if (!authResolved) {

        authResolved = true;

        authReadyResolve(user);

    }

});


/* =========================================
   WebRTC
========================================= */

let peerConnection = null;

let localStream = null;

let remoteStream = null;

let stopCallListeners = [];

let pendingCandidates = [];

let remoteDescriptionReady = false;


/* =========================================
   حماية تعدد المكالمات
========================================= */

let activeCallId = null;


/* =========================================
   Stream
========================================= */

function exposeLocalStream() {

    window.localCallStream =
        localStream;

    window.localStream =
        localStream;

}


/* =========================================
   Call ID
========================================= */

function createCallID() {

    return (
        Date.now().toString(36)
        +
        "_"
        +
        Math.random()
            .toString(36)
            .substring(2, 10)
    );

}


/* =========================================
   انتظار تسجيل الدخول
========================================= */

async function waitForAuth() {

    const user = await authReady;

    if (!user) {

        throw new Error(
            "يجب تسجيل الدخول أولاً"
        );

    }

    currentUser = user;

    return user;

}


/* =========================================
   بدء المكالمة من chat.html
========================================= */

export async function startCall({

    friendId,
    friendName,
    friendPhoto

}) {

    const user =
        await waitForAuth();

    if (!friendId) {

        throw new Error(
            "لم يتم تحديد الصديق"
        );

    }

    if (friendId === user.uid) {

        throw new Error(
            "لا يمكنك الاتصال بنفسك"
        );

    }


    if (activeCallId) {

        throw new Error(
            "هناك مكالمة قيد التشغيل"
        );

    }


    const callId =
        createCallID();

    activeCallId =
        callId;


    try {

        const callerName =
            user.displayName ||
            user.email?.split("@")[0] ||
            "مستخدم Mecd";

        const callerPhoto =
            user.photoURL || "";

        const receiverName =
            friendName ||
            "مستخدم Mecd";

        const receiverPhoto =
            friendPhoto ||
            "";


        /* =========================
           إنشاء المكالمة
        ========================= */

        await setDoc(

            doc(
                db,
                "calls",
                callId
            ),

            {

                callId,

                callerId:
                    user.uid,

                receiverId:
                    friendId,

                callerName,

                callerPhoto,

                receiverName,

                receiverPhoto,

                type:
                    "audio",

                status:
                    "ringing",

                createdAt:
                    serverTimestamp()

            }

        );


        /* =========================
           إشعار المستخدم الآخر
        ========================= */

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
                        user.uid,

                    callerName,

                    callerPhoto,

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


        /* =========================
           فتح صفحة المكالمة
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

        params.set(
            "name",
            receiverName
        );

        params.set(
            "photo",
            receiverPhoto
        );


        window.location.href =
            "call.html?" +
            params.toString();


    } catch (error) {

        activeCallId = null;

        console.error(
            "Start call error:",
            error
        );

        throw error;

    }

}


/* =========================================
   استقبال المكالمات
========================================= */

let incomingListenerStarted = false;

let incomingUnsubscribe = null;


export async function listenIncomingCalls() {

    const user =
        await authReady;

    if (!user) {
        return null;
    }


    /*
     * منع تشغيل listener أكثر من مرة
     */

    if (incomingListenerStarted) {

        return incomingUnsubscribe;

    }

    incomingListenerStarted = true;


    const userRef =
        doc(
            db,
            "users",
            user.uid
        );


    incomingUnsubscribe =
        onSnapshot(

            userRef,

            snapshot => {

                if (!snapshot.exists()) {
                    return;
                }


                const data =
                    snapshot.data();


                const incoming =
                    data.incomingCall;


                /*
                 * لا توجد مكالمة
                 */

                if (!incoming) {
                    return;
                }


                /*
                 * ليست للمستخدم الحالي
                 */

                if (
                    incoming.receiverId !==
                    user.uid
                ) {

                    return;

                }


                /*
                 * ليست بحالة رنين
                 */

                if (
                    incoming.status !==
                    "ringing"
                ) {

                    return;

                }


                /*
                 * منع التكرار
                 */

                if (
                    window.currentIncomingCallId ===
                    incoming.callId
                ) {

                    return;

                }


                /*
                 * إذا كنا داخل مكالمة
                 * لا نفتح مكالمة جديدة
                 */

                if (activeCallId) {
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


                /*
                 * فتح call.html
                 */

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


    return incomingUnsubscribe;

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

        id:
            snapshot.id,

        ...snapshot.data()

    };

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

    const user =
        await authReady;

    if (!user) {
        return;
    }


    try {

        await updateDoc(

            doc(
                db,
                "users",
                user.uid
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
   الميكروفون
========================================= */

async function getMicrophone() {

    if (localStream) {

        exposeLocalStream();

        return localStream;

    }


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        throw new Error(
            "المتصفح لا يدعم الميكروفون"
        );

    }


    try {

        localStream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    audio: {

                        echoCancellation:
                            true,

                        noiseSuppression:
                            true,

                        autoGainControl:
                            true

                    },

                    video: false

                });


        exposeLocalStream();

        return localStream;

    } catch (error) {

        console.error(
            "Microphone error:",
            error
        );

        throw new Error(
            "لم يتم السماح باستخدام الميكروفون"
        );

    }

}


/* =========================================
   إنشاء PeerConnection
========================================= */

function createPeerConnection(callId) {

    remoteStream =
        new MediaStream();


    const pc =
        new RTCPeerConnection({

            iceServers: [

                {
                    urls:
                        "stun:stun.l.google.com:19302"
                },

                {
                    urls:
                        "stun:stun1.l.google.com:19302"
                },

                {
                    urls:
                        "stun:stun2.l.google.com:19302"
                }

            ]

        });


    /* =====================================
       ICE
    ===================================== */

    pc.onicecandidate =
        async event => {

            if (!event.candidate) {
                return;
            }

            if (!currentUser) {
                return;
            }


            try {

                await addDoc(

                    collection(
                        db,
                        "calls",
                        callId,
                        "candidates"
                    ),

                    {

                        candidate:
                            event.candidate.toJSON(),

                        senderId:
                            currentUser.uid,

                        createdAt:
                            serverTimestamp()

                    }

                );

            } catch (error) {

                console.error(
                    "ICE error:",
                    error
                );

            }

        };


    /* =====================================
       الصوت القادم
    ===================================== */

    pc.ontrack =
        event => {

            if (
                event.streams &&
                event.streams.length
            ) {

                const stream =
                    event.streams[0];


                stream
                    .getTracks()
                    .forEach(track => {

                        const exists =
                            remoteStream
                                .getTracks()
                                .some(
                                    t =>
                                        t.id ===
                                        track.id
                                );


                        if (!exists) {

                            remoteStream.addTrack(
                                track
                            );

                        }

                    });

            } else {

                const exists =
                    remoteStream
                        .getTracks()
                        .some(
                            t =>
                                t.id ===
                                event.track.id
                        );


                if (!exists) {

                    remoteStream.addTrack(
                        event.track
                    );

                }

            }


            if (
                typeof window.onRemoteStream ===
                "function"
            ) {

                window.onRemoteStream(
                    remoteStream
                );

            }

        };


    /* =====================================
       حالة الاتصال
    ===================================== */

    pc.onconnectionstatechange =
        () => {

            console.log(
                "WebRTC:",
                pc.connectionState
            );


            if (
                pc.connectionState ===
                "connected"
            ) {

                if (
                    typeof window.onCallConnected ===
                    "function"
                ) {

                    window.onCallConnected();

                }

            }


            if (
                pc.connectionState ===
                "failed"
            ) {

                if (
                    typeof window.onCallFailed ===
                    "function"
                ) {

                    window.onCallFailed();

                }

            }


            if (
                pc.connectionState ===
                "disconnected"
            ) {

                console.log(
                    "WebRTC disconnected"
                );

            }

        };


    return pc;

}


/* =========================================
   إضافة الصوت المحلي
========================================= */

function addLocalTracks() {

    if (
        !peerConnection ||
        !localStream
    ) {

        return;

    }


    const senders =
        peerConnection.getSenders();


    localStream
        .getTracks()
        .forEach(track => {

            const exists =
                senders.some(
                    sender =>
                        sender.track &&
                        sender.track.id ===
                        track.id
                );


            if (!exists) {

                peerConnection.addTrack(
                    track,
                    localStream
                );

            }

        });

}


/* =========================================
   مراقبة المكالمة
========================================= */

function listenCallDocument(
    callId,
    callback
) {

    const callRef =
        doc(
            db,
            "calls",
            callId
        );


    const unsubscribe =
        onSnapshot(

            callRef,

            snapshot => {

                if (
                    !snapshot.exists()
                ) {

                    callback(null);

                    return;

                }


                callback(
                    snapshot.data()
                );

            },

            error => {

                console.error(
                    "Call listener error:",
                    error
                );

            }

        );


    stopCallListeners.push(
        unsubscribe
    );


    return unsubscribe;

}


/* =========================================
   مراقبة ICE
========================================= */

function listenCandidates(
    callId,
    ownUserId
) {

    const candidatesRef =
        collection(
            db,
            "calls",
            callId,
            "candidates"
        );


    const unsubscribe =
        onSnapshot(

            candidatesRef,

            snapshot => {

                snapshot
                    .docChanges()
                    .forEach(
                        async change => {

                            if (
                                change.type !==
                                "added"
                            ) {

                                return;

                            }


                            const data =
                                change.doc.data();


                            if (
                                data.senderId ===
                                ownUserId
                            ) {

                                return;

                            }


                            if (
                                !data.candidate
                            ) {

                                return;

                            }


                            const candidate =
                                new RTCIceCandidate(
                                    data.candidate
                                );


                            if (
                                !remoteDescriptionReady
                            ) {

                                pendingCandidates.push(
                                    candidate
                                );

                                return;

                            }


                            try {

                                if (
                                    peerConnection
                                ) {

                                    await peerConnection
                                        .addIceCandidate(
                                            candidate
                                        );

                                }

                            } catch (error) {

                                console.error(
                                    "ICE add error:",
                                    error
                                );

                            }

                        }
                    );

            },

            error => {

                console.error(
                    "ICE listener error:",
                    error
                );

            }

        );


    stopCallListeners.push(
        unsubscribe
    );


    return unsubscribe;

}


/* =========================================
   إضافة ICE المؤجل
========================================= */

async function flushPendingCandidates() {

    if (
        !peerConnection ||
        !remoteDescriptionReady
    ) {

        return;

    }


    const candidates =
        [...pendingCandidates];


    pendingCandidates =
        [];


    for (
        const candidate
        of candidates
    ) {

        try {

            await peerConnection
                .addIceCandidate(
                    candidate
                );

        } catch (error) {

            console.error(
                "Pending ICE error:",
                error
            );

        }

    }

}


/* =========================================
   المكالمة الصادرة
========================================= */

export async function startOutgoingCall(
    callId
) {

    const user =
        await waitForAuth();


    const call =
        await getCall(callId);


    if (!call) {

        throw new Error(
            "المكالمة غير موجودة"
        );

    }


    if (
        call.callerId !==
        user.uid
    ) {

        throw new Error(
            "هذه المكالمة ليست لك"
        );

    }


    activeCallId =
        callId;


    remoteDescriptionReady =
        false;

    pendingCandidates =
        [];


    await getMicrophone();


    peerConnection =
        createPeerConnection(
            callId
        );


    addLocalTracks();


    listenCandidates(
        callId,
        user.uid
    );


    /*
     * إنشاء Offer
     */

    const offer =
        await peerConnection
            .createOffer({

                offerToReceiveAudio:
                    true

            });


    await peerConnection
        .setLocalDescription(
            offer
        );


    await updateDoc(

        doc(
            db,
            "calls",
            callId
        ),

        {

            offer: {

                type:
                    offer.type,

                sdp:
                    offer.sdp

            },

            status:
                "calling"

        }

    );


    /*
     * مراقبة Answer
     */

    listenCallDocument(

        callId,

        async data => {

            if (!data) {

                window.onCallEnded?.();

                return;

            }


            if (
                data.status ===
                "ended"
            ) {

                window.onCallEnded?.();

                return;

            }


            if (
                data.answer &&
                peerConnection &&
                !remoteDescriptionReady
            ) {

                try {

                    await peerConnection
                        .setRemoteDescription(

                            new RTCSessionDescription(
                                data.answer
                            )

                        );


                    remoteDescriptionReady =
                        true;


                    await flushPendingCandidates();

                } catch (error) {

                    console.error(
                        "Set answer error:",
                        error
                    );

                }

            }

        }

    );

}


/* =========================================
   قبول المكالمة
========================================= */

export async function acceptIncomingCall(
    callId
) {

    const user =
        await waitForAuth();


    const call =
        await getCall(callId);


    if (!call) {

        throw new Error(
            "المكالمة غير موجودة"
        );

    }


    if (
        call.receiverId !==
        user.uid
    ) {

        throw new Error(
            "هذه المكالمة ليست لك"
        );

    }


    if (!call.offer) {

        throw new Error(
            "لم يصل طلب الاتصال بعد"
        );

    }


    activeCallId =
        callId;


    remoteDescriptionReady =
        false;

    pendingCandidates =
        [];


    await getMicrophone();


    peerConnection =
        createPeerConnection(
            callId
        );


    addLocalTracks();


    listenCandidates(
        callId,
        user.uid
    );


    /*
     * وضع Offer
     */

    await peerConnection
        .setRemoteDescription(

            new RTCSessionDescription(
                call.offer
            )

        );


    remoteDescriptionReady =
        true;


    await flushPendingCandidates();


    /*
     * إنشاء Answer
     */

    const answer =
        await peerConnection
            .createAnswer();


    await peerConnection
        .setLocalDescription(
            answer
        );


    await updateDoc(

        doc(
            db,
            "calls",
            callId
        ),

        {

            answer: {

                type:
                    answer.type,

                sdp:
                    answer.sdp

            },

            status:
                "connected"

        }

    );


    /*
     * مراقبة إنهاء المكالمة
     */

    listenCallDocument(

        callId,

        data => {

            if (
                !data ||
                data.status ===
                "ended"
            ) {

                window.onCallEnded?.();

            }

        }

    );

}


/* =========================================
   مراقبة المكالمة الواردة
========================================= */

export async function watchIncomingCall(
    callId
) {

    await waitForAuth();


    activeCallId =
        callId;


    listenCallDocument(

        callId,

        data => {

            if (!data) {

                window.onCallEnded?.();

                return;

            }


            if (
                data.status ===
                "ended"
            ) {

                window.onCallEnded?.();

            }

        }

    );

}


/* =========================================
   تنظيف المكالمة
========================================= */

export async function cleanupCall(
    callId
) {

    const id =
        callId ||
        activeCallId;


    try {

        /*
         * إيقاف الميكروفون
         */

        if (localStream) {

            localStream
                .getTracks()
                .forEach(track => {

                    track.stop();

                });


            localStream =
                null;

        }


        window.localStream =
            null;

        window.localCallStream =
            null;


        /*
         * إغلاق WebRTC
         */

        if (peerConnection) {

            try {

                peerConnection.close();

            } catch {}

            peerConnection =
                null;

        }


        remoteStream =
            null;


        /*
         * إلغاء listeners
         */

        stopCallListeners
            .forEach(
                unsubscribe => {

                    try {

                        unsubscribe();

                    } catch {}

                }
            );


        stopCallListeners =
            [];


        pendingCandidates =
            [];


        remoteDescriptionReady =
            false;


        /*
         * إنهاء المكالمة في Firebase
         */

        if (id) {

            await endCall(id);

        }


        /*
         * إزالة incomingCall
         */

        await clearIncomingCall();


        activeCallId =
            null;


        window.currentIncomingCallId =
            null;


    } catch (error) {

        console.error(
            "Cleanup error:",
            error
        );

    }

}


/* =========================================
   الحصول على الميكروفون
========================================= */

export function getLocalStream() {

    return localStream;

}


/* =========================================
   إغلاق Incoming Listener
========================================= */

export function stopIncomingCallsListener() {

    if (incomingUnsubscribe) {

        try {

            incomingUnsubscribe();

        } catch {}

        incomingUnsubscribe =
            null;

    }

    incomingListenerStarted =
        false;

}


/* =========================================
   حالة المكالمة
========================================= */

export function getActiveCallId() {

    return activeCallId;

}
