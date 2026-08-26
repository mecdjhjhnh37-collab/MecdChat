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
    deleteDoc,
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

        const callId =
            createCallID();


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


        /* =================================
           إنشاء المكالمة
           ================================= */

        await setDoc(

            doc(
                db,
                "calls",
                callId
            ),

            callData

        );


        /* =================================
           إرسال المكالمة للمستخدم الثاني
           ================================= */

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


        /* =================================
           فتح شاشة الاتصال
           ================================= */

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
   WebRTC
   ========================================= */

let peerConnection = null;

let localStream = null;

let remoteStream = null;

let stopCallListeners = [];


/* =========================================
   إعداد WebRTC
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


    /* =================================
       ICE Candidate
       ================================= */

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


    /* =================================
       الصوت القادم
       ================================= */

    pc.ontrack =
        event => {

            if (!remoteStream) {

                remoteStream =
                    new MediaStream();

            }


            event.streams[0]
                ?.getTracks()
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
   الحصول على الميكروفون
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

                    video:
                        false

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
   إضافة الصوت إلى WebRTC
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
   مراقبة حالة المكالمة
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

                    onCallChange(
                        null
                    );

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
   مراقبة ICE Candidates
   ========================================= */

function listenCandidates(
    callId,
    senderId,
    callback
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

                                await peerConnection
                                    ?.addIceCandidate(

                                        new RTCIceCandidate(
                                            data.candidate
                                        )

                                    );

                            } catch (error) {

                                console.error(
                                    "Add ICE error:",
                                    error
                                );

                            }

                        }
                    );

            }

        );


    stopCallListeners.push(
        unsubscribe
    );


    return unsubscribe;

}


/* =========================================
   بدء WebRTC للطرف المتصل
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


    localStream =
        await getMicrophone();


    peerConnection =
        createPeerConnection(
            callId
        );


    addLocalTracks();


    /* =================================
       إنشاء Offer
       ================================= */

    const offer =
        await peerConnection
            .createOffer();


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


    /* =================================
       انتظار Answer
       ================================= */

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

        currentUser.uid,

        () => {}

    );

}


/* =========================================
   قبول المكالمة للطرف المستقبل
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


    localStream =
        await getMicrophone();


    peerConnection =
        createPeerConnection(
            callId
        );


    addLocalTracks();


    /* =================================
       وضع Offer القادم
       ================================= */

    await peerConnection
        .setRemoteDescription(

            new RTCSessionDescription(
                call.offer
            )

        );


    /* =================================
       إنشاء Answer
       ================================= */

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


    /* =================================
       مراقبة إنهاء المكالمة
       ================================= */

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

        currentUser.uid,

        () => {}

    );

}


/* =========================================
   مراقبة المكالمة بدون قبول
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
   إنهاء WebRTC وتنظيف الموارد
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

            localStream =
                null;

        }


        if (peerConnection) {

            peerConnection.close();

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
