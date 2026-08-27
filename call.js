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
    getApps().length ? getApp() : null;

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

let authReadyResolve;

const authReady = new Promise(resolve => {
    authReadyResolve = resolve;
});

onAuthStateChanged(auth, user => {
    currentUser = user;
    authReadyResolve(user);
});


/* =========================================
   Call ID
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


        /* إنشاء المكالمة */

        await setDoc(
            doc(db, "calls", callId),
            callData
        );


        /* إرسال المكالمة للطرف الثاني */

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


        /* فتح شاشة الاتصال */

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
   المكالمات الواردة
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
   WebRTC
   ========================================= */

let peerConnection = null;
let localStream = null;
let remoteStream = null;

let stopCallListeners = [];


/* =========================================
   إنشاء PeerConnection
   ========================================= */

function createPeerConnection(callId) {

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


    /* ICE */

    pc.onicecandidate =
        async event => {

            if (!event.candidate) {
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


    /* الصوت القادم */

    pc.ontrack =
        event => {

            if (!remoteStream) {
                remoteStream =
                    new MediaStream();
            }

            const stream =
                event.streams[0];

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

            }

            if (
                window.onRemoteStream
            ) {

                window.onRemoteStream(
                    remoteStream
                );

            }

        };


    return pc;
}


/* =========================================
   الميكروفون
   ========================================= */

async function getMicrophone() {

    try {

        localStream =
            await navigator.mediaDevices
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
   إضافة الصوت
   ========================================= */

function addLocalTracks() {

    if (
        !peerConnection ||
        !localStream
    ) {
        return;
    }

    localStream
        .getTracks()
        .forEach(track => {

            peerConnection.addTrack(
                track,
                localStream
            );

        });
}


/* =========================================
   مراقبة المكالمة
   ========================================= */

function listenCallDocument(
    callId,
    onCallChange
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

                    onCallChange(null);
                    return;

                }

                onCallChange(
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
    senderId
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

                snapshot.docChanges()
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
                                senderId
                            ) {
                                return;
                            }

                            if (
                                !data.candidate
                            ) {
                                return;
                            }

                            try {

                                if (
                                    peerConnection
                                ) {

                                    await peerConnection
                                        .addIceCandidate(

                                            new RTCIceCandidate(
                                                data.candidate
                                            )

                                        );

                                }

                            } catch (error) {

                                console.error(
                                    "Add ICE error:",
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
   الطرف المتصل
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


    /* الميكروفون */

    await getMicrophone();


    /* Peer */

    peerConnection =
        createPeerConnection(
            callId
        );


    addLocalTracks();


    /* Offer */

    const offer =
        await peerConnection
            .createOffer();

    await peerConnection
        .setLocalDescription(
            offer
        );


    /* حفظ Offer */

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
                    window.onCallEnded
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
                    window.onCallEnded
                ) {
                    window.onCallEnded();
                }

                return;
            }


            if (
                data.answer &&
                peerConnection &&
                !peerConnection
                    .currentRemoteDescription
            ) {

                try {

                    await peerConnection
                        .setRemoteDescription(

                            new RTCSessionDescription(
                                data.answer
                            )

                        );

                } catch (error) {

                    console.error(
                        "Set answer error:",
                        error
                    );

                }

            }

        }

    );


    listenCandidates(
        callId,
        currentUser.uid
    );
}


/* =========================================
   الطرف المستقبل
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


    /* الميكروفون */

    await getMicrophone();


    /* Peer */

    peerConnection =
        createPeerConnection(
            callId
        );


    addLocalTracks();


    /* Offer */

    await peerConnection
        .setRemoteDescription(

            new RTCSessionDescription(
                call.offer
            )

        );


    /* Answer */

    const answer =
        await peerConnection
            .createAnswer();

    await peerConnection
        .setLocalDescription(
            answer
        );


    /* حفظ Answer */

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


    /* مراقبة الإنهاء */

    listenCallDocument(

        callId,

        data => {

            if (
                !data ||
                data.status ===
                "ended"
            ) {

                if (
                    window.onCallEnded
                ) {
                    window.onCallEnded();
                }

            }

        }

    );


    listenCandidates(
        callId,
        currentUser.uid
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
                    window.onCallEnded
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
                    window.onCallEnded
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

        if (localStream) {

            localStream
                .getTracks()
                .forEach(track => {
                    track.stop();
                });

            localStream = null;
        }


        if (peerConnection) {

            peerConnection.close();

            peerConnection = null;
        }


        remoteStream = null;


        stopCallListeners
            .forEach(unsubscribe => {

                try {
                    unsubscribe();
                } catch {}

            });


        stopCallListeners = [];


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
