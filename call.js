/* =========================================
   Mecd Chat
   Voice Call System
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
    updateDoc,
    onSnapshot,
    collection,
    addDoc,
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
   المستخدم
========================================= */

let currentUser = null;

let authReadyResolve;

const authReady =
    new Promise(resolve => {

        authReadyResolve = resolve;

    });


onAuthStateChanged(
    auth,
    user => {

        currentUser = user;

        authReadyResolve(user);

    }
);


/* =========================================
   WebRTC
========================================= */

let peerConnection = null;

let localStream = null;

let remoteStream = null;

let activeCallId = null;

let remoteDescriptionReady = false;

let pendingCandidates = [];

let stopCallListeners = [];


/* =========================================
   انتظار تسجيل الدخول
========================================= */

async function waitForAuth() {

    const user =
        await authReady;

    if (!user) {

        throw new Error(
            "يجب تسجيل الدخول أولاً"
        );

    }

    currentUser = user;

    return user;

}


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
   الحصول على الميكروفون
========================================= */

async function getMicrophone() {

    if (localStream) {

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

                        echoCancellation: true,

                        noiseSuppression: true,

                        autoGainControl: true

                    },

                    video: false

                });

        window.localStream =
            localStream;

        window.localCallStream =
            localStream;

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

            const stream =
                event.streams?.[0];

            if (stream) {

                stream
                    .getTracks()
                    .forEach(track => {

                        if (
                            !remoteStream
                                .getTracks()
                                .some(
                                    t =>
                                        t.id ===
                                        track.id
                                )
                        ) {

                            remoteStream.addTrack(
                                track
                            );

                        }

                    });

            } else {

                if (
                    !remoteStream
                        .getTracks()
                        .some(
                            t =>
                                t.id ===
                                event.track.id
                        )
                ) {

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

    const unsubscribe =
        onSnapshot(

            doc(
                db,
                "calls",
                callId
            ),

            snapshot => {

                if (!snapshot.exists()) {

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

    const unsubscribe =
        onSnapshot(

            collection(
                db,
                "calls",
                callId,
                "candidates"
            ),

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

}


/* =========================================
   ICE المؤجل
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

    pendingCandidates = [];

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
   ⭐ START CALL
========================================= */

export async function startCall({

    friendId,
    friendName,
    friendPhoto

}) {

    console.log(
        "📞 startCall() تعمل"
    );

    const user =
        await waitForAuth();

    if (!friendId) {

        throw new Error(
            "لم يتم تحديد الصديق"
        );

    }

    if (
        friendId ===
        user.uid
    ) {

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
            user.photoURL ||
            "";

        const receiverName =
            friendName ||
            "مستخدم Mecd";

        const receiverPhoto =
            friendPhoto ||
            "";


        /* =====================================
           إنشاء المكالمة
        ===================================== */

        await setDoc(

            doc(
                db,
                "calls",
                callId
            ),

            {

                callId:

                    callId,

                callerId:

                    user.uid,

                receiverId:

                    friendId,

                callerName:

                    callerName,

                callerPhoto:

                    callerPhoto,

                receiverName:

                    receiverName,

                receiverPhoto:

                    receiverPhoto,

                type:

                    "audio",

                status:

                    "ringing",

                createdAt:

                    serverTimestamp()

            }

        );


        /* =====================================
           تسجيل المكالمة الواردة عند المستقبل
        ===================================== */

        await setDoc(

            doc(
                db,
                "users",
                friendId
            ),

            {

                incomingCall: {

                    callId:

                        callId,

                    callerId:

                        user.uid,

                    callerName:

                        callerName,

                    callerPhoto:

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


        /* =====================================
           الانتقال إلى call.html
        ===================================== */

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
            "./call.html?" +
            params.toString();


    } catch (error) {

        activeCallId =
            null;

        console.error(
            "startCall error:",
            error
        );

        throw error;

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
                        "Answer error:",
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


    await peerConnection
        .setRemoteDescription(

            new RTCSessionDescription(
                call.offer
            )

        );

    remoteDescriptionReady =
        true;

    await flushPendingCandidates();


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
   الحصول على المكالمة
========================================= */

export async function getCall(
    callId
) {

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

export async function endCall(
    callId
) {

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
   حذف Incoming Call
========================================= */

export async function clearIncomingCall() {

    const user =
        await waitForAuth();

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
   تنظيف
========================================= */

export async function cleanupCall(
    callId
) {

    const id =
        callId ||
        activeCallId;


    try {

        if (localStream) {

            localStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

            localStream =
                null;

        }


        window.localStream =
            null;

        window.localCallStream =
            null;


        if (peerConnection) {

            try {

                peerConnection.close();

            } catch {}

            peerConnection =
                null;

        }


        remoteStream =
            null;


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


        if (id) {

            await endCall(
                id
            );

        }


        await clearIncomingCall();


        activeCallId =
            null;


    } catch (error) {

        console.error(
            "Cleanup error:",
            error
        );

    }

}


/* =========================================
   Local Stream
========================================= */

export function getLocalStream() {

    return localStream;

}


/* =========================================
   تشغيل استقبال المكالمات
========================================= */

let incomingUnsubscribe =
    null;

let incomingListenerStarted =
    false;


export async function listenIncomingCalls() {

    const user =
        await waitForAuth();

    if (
        incomingListenerStarted
    ) {

        return incomingUnsubscribe;

    }

    incomingListenerStarted =
        true;


    incomingUnsubscribe =
        onSnapshot(

            doc(
                db,
                "users",
                user.uid
            ),

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
                    user.uid
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
                    "./call.html?" +
                    params.toString();

            },

            error => {

                console.error(
                    "Incoming call listener:",
                    error
                );

            }

        );

    return incomingUnsubscribe;

}


/* =========================================
   إيقاف Listener
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
   Active Call
========================================= */

export function getActiveCallId() {

    return activeCallId;

}


/* =========================================
   اختبار
========================================= */

console.log(
    "✅ call.js v2 loaded - startCall موجودة"
);
