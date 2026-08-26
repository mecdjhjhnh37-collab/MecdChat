/* =========================================
   Mecd Chat - Real Voice Call System
   WebRTC + Firestore
   Firebase v10.12.2
   ========================================= */

import {
    initializeApp,
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

const firebaseConfig = {
    apiKey: "AIzaSyA8ZA5fcy1Tl3hZ7_5n91xVOw06syHPGyI",
    authDomain: "mecd-tools.firebaseapp.com",
    projectId: "mecd-tools",
    storageBucket: "mecd-tools.firebasestorage.app",
    messagingSenderId: "643005547408",
    appId: "1:643005547408:web:b1719060ec340dd0e0a915"
};


const firebaseApp =
    getApps().length
        ? getApp()
        : initializeApp(firebaseConfig);


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
        throw new Error("يجب تسجيل الدخول أولاً");
    }

    if (!friendId) {
        throw new Error("لم يتم تحديد الصديق");
    }

    if (friendId === currentUser.uid) {
        throw new Error("لا يمكنك الاتصال بنفسك");
    }


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


    try {

        /* إنشاء المكالمة */

        await setDoc(
            doc(db, "calls", callId),
            callData
        );


        /* إرسال المكالمة للطرف الآخر */

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

        params.set(
            "name",
            friendName || "مستخدم Mecd"
        );

        params.set(
            "photo",
            friendPhoto || ""
        );


        window.location.href =
            "call.html?" +
            params.toString();


    } catch (error) {

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
   جلب المكالمة
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
   WebRTC
========================================= */

let peerConnection = null;

let localStream = null;

let remoteStream = null;

let stopCallListeners = [];

let pendingCandidates = [];


/* =========================================
   إنشاء Peer Connection
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
                    "ICE error:",
                    error
                );

            }

        };


    pc.ontrack =
        event => {

            if (!remoteStream) {
                remoteStream =
                    new MediaStream();
            }


            const tracks =
                event.streams[0]
                    ?.getTracks() || [];


            tracks.forEach(track => {

                if (
                    !remoteStream
                        .getTracks()
                        .some(
                            t =>
                                t.id === track.id
                        )
                ) {

                    remoteStream.addTrack(
                        track
                    );

                }

            });


            window.onRemoteStream?.(
                remoteStream
            );

        };


    pc.onconnectionstatechange =
        () => {

            console.log(
                "WebRTC state:",
                pc.connectionState
            );


            if (
                pc.connectionState ===
                "connected"
            ) {

                window.onCallConnected?.();

            }


            if (
                pc.connectionState ===
                "failed"
            ) {

                window.onCallError?.(
                    "فشل الاتصال بين الهاتفين"
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

                        echoCancellation: true,

                        noiseSuppression: true,

                        autoGainControl: true

                    },

                    video: false

                });


        /* مهم لزر الكتم */

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
   ICE
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


                            /*
                             * إذا لم يتم وضع Remote Description
                             * بعد، نخزن الـ candidate.
                             */

                            if (
                                !peerConnection ||
                                !peerConnection
                                    .remoteDescription
                            ) {

                                pendingCandidates.push(
                                    candidate
                                );

                                return;

                            }


                            try {

                                await peerConnection
                                    .addIceCandidate(
                                        candidate
                                    );

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
                    "Candidates listener error:",
                    error
                );

            }

        );


    stopCallListeners.push(
        unsubscribe
    );

}


/* =========================================
   إضافة Candidates المؤجلة
========================================= */

async function flushPendingCandidates() {

    if (
        !peerConnection ||
        !peerConnection.remoteDescription
    ) {
        return;
    }


    const list =
        [...pendingCandidates];


    pendingCandidates = [];


    for (
        const candidate of list
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


    localStream =
        await getMicrophone();


    peerConnection =
        createPeerConnection(
            callId
        );


    addLocalTracks();


    listenCandidates(
        callId,
        currentUser.uid
    );


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


                    await flushPendingCandidates();


                    window.onCallConnected?.();


                } catch (error) {

                    console.error(
                        "Answer error:",
                        error
                    );

                    window.onCallError?.(
                        "تعذر إنشاء الاتصال"
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


    listenCandidates(
        callId,
        currentUser.uid
    );


    await peerConnection
        .setRemoteDescription(

            new RTCSessionDescription(
                call.offer
            )

        );


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


    window.onCallConnected?.();


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
   مراقبة الوارد
========================================= */

export async functi
