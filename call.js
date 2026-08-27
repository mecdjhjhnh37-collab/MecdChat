/* =========================================
   Mecd Chat - Real Voice Call System
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

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);


/* =========================================
   المستخدم الحالي
========================================= */

let currentUser = null;

let authReadyResolve;

const authReady = new Promise(resolve => {
    authReadyResolve = resolve;
});

onAuthStateChanged(auth, user => {

    currentUser = user;

    authReadyResolve(user);

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
   كشف الميكروفون للصفحة
========================================= */

function exposeLocalStream() {

    window.localStream = localStream;

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
   بدء المكالمة
========================================= */

export async function startCall({
    friendId,
    friendName,
    friendPhoto
}) {

    await authReady;

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


        await setDoc(
            doc(db, "calls", callId),
            callData
        );


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
            friendName ||
            "مستخدم Mecd"
        );

        params.set(
            "photo",
            friendPhoto ||
            ""
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
   استقبال المكالمات
========================================= */

export async function listenIncomingCalls() {

    await authReady;

    if (!currentUser) {
        return null;
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
   الحصول على بيانات المكالمة
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
   مسح المكالمة الواردة
========================================= */

export async function clearIncomingCall() {

    await authReady;

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
                incomingCall: null
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
   الحصول على الميكروفون
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
            "المتصفح لا يدعم استخدام الميكروفون"
        );

    }


    try {

        localStream =
            await navigator.mediaDevices
                .getUserMedia({

                    audio: {

                        echoCancellation: true,

                        noiseSuppression: true,

                        autoGainControl: true

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
                    "ICE candidate error:",
                    error
                );

            }

        };


    /* =====================================
       الصوت القادم
    ===================================== */

    pc.ontrack =
        event => {

            const streams =
                event.streams || [];


            if (streams.length) {

                streams[0]
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

            const alreadyAdded =
                senders.some(
                    sender =>
                        sender.track &&
                        sender.track.id ===
                        track.id
                );


            if (!alreadyAdded) {

                peerConnection.addTrack(
                    track,
                    localStream
                );

            }

        });

}


/* =========================================
   مراقبة وثيقة المكالمة
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
   مراقبة ICE Candidates
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
   المكالمة الصادرة
========================================= */

export async function startOutgoingCall(
    callId
) {

    await authReady;


    if (!currentUser) {

        throw new Error(
            "يجب تسجيل الدخول"
        );

    }


    const call =
        await getCall(callId);


    if (!call) {

        throw new Error(
            "المكالمة غير موجودة"
        );

    }


    remoteDescriptionReady = false;

    pendingCandidates = [];


    await getMicrophone();


    peerConnection =
        createPeerConnection(
            callId
        );


    addLocalTracks();


    /* الاستماع للـ ICE أولاً */

    listenCandidates(
        callId,
        currentUser.uid
    );


    /* إنشاء Offer */

    const offer =
        await peerConnection
            .createOffer({

                offerToReceiveAudio: true

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


    /* مراقبة Answer */

    listenCallDocument(

        callId,

        async data => {

            if (!data) {

                if (
                    typeof window.onCallEnded ===
                    "function"
                ) {

                    window.onCallEnded();

                }

                return;

            }


            if (
                data.status ===
                "ended"
            ) {

                if (
                    typeof window.onCallEnded ===
                    "function"
                ) {

                    window.onCallEnded();

                }

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
   قبول المكالمة الواردة
========================================= */

export async function acceptIncomingCall(
    callId
) {

    await authReady;


    if (!currentUser) {

        throw new Error(
            "يجب تسجيل الدخول"
        );

    }


    const call =
        await getCall(callId);


    if (!call) {

        throw new Error(
            "المكالمة غير موجودة"
        );

    }


    if (
        call.receiverId !==
        currentUser.uid
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


    remoteDescriptionReady = false;

    pendingCandidates = [];


    await getMicrophone();


    peerConnection =
        createPeerConnection(
            callId
        );


    addLocalTracks();


    /* الاستماع للـ ICE */

    listenCandidates(
        callId,
        currentUser.uid
    );


    /* وضع Offer */

    await peerConnection
        .setRemoteDescription(

            new RTCSessionDescription(
                call.offer
            )

        );


    remoteDescriptionReady =
        true;


    await flushPendingCandidates();


    /* إنشاء Answer */

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


    /* مراقبة انتهاء المكالمة */

    listenCallDocument(

        callId,

        data => {

            if (
                !data ||
                data.status ===
                "ended"
            ) {

                if (
                    typeof window.onCallEnded ===
                    "function"
                ) {

                    window.onCallEnded();

                }

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

    await authReady;


    if (!currentUser) {
        return;
    }


    listenCallDocument(

        callId,

        data => {

            if (!data) {

                if (
                    typeof window.onCallEnded ===
                    "function"
                ) {

                    window.onCallEnded();

                }

                return;

            }


            if (
                data.status ===
                "ended"
            ) {

                if (
                    typeof window.onCallEnded ===
                    "function"
                ) {

                    window.onCallEnded();

                }

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

    try {

        /* إيقاف الميكروفون */

        if (localStream) {

            localStream
                .getTracks()
                .forEach(track => {

                    track.stop();

                });

            localStream = null;

        }


        window.localStream = null;


        /* إغلاق الاتصال */

        if (peerConnection) {

            try {
                peerConnection.close();
            } catch {}

            peerConnection = null;

        }


        remoteStream = null;


        /* إلغاء المستمعين */

        stopCallListeners
            .forEach(
                unsubscribe => {

                    try {

                        unsubscribe();

                    } catch {}

                }
            );


        stopCallListeners = [];


        pendingCandidates = [];

        remoteDescriptionReady =
            false;


        /* تحديث حالة المكالمة */

        if (callId) {

            await endCall(
                callId
            );

        }

    } catch (error) {

        console.error(
            "Cleanup error:",
            error
        );

    }

}


/* =========================================
   تصدير Stream عند الحاجة
========================================= */

export function getLocalStream() {

    return localStream;

}
