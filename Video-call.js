import {
    initializeApp,
    getApps
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    addDoc,
    onSnapshot,
    serverTimestamp
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =========================================================
   Firebase
========================================================= */

const firebaseConfig = {

    apiKey:
        "AIzaSyA8ZA5fcy1Tl3hZ7_5n91xVOw06syHPGyI",

    authDomain:
        "mecd-tools.firebaseapp.com",

    projectId:
        "mecd-tools",

    storageBucket:
        "mecd-tools.firebasestorage.app",

    messagingSenderId:
        "643005547408",

    appId:
        "1:643005547408:web:b1719060ec340dd0e0a915"

};


const app =
    getApps().length
    ?
    getApps()[0]
    :
    initializeApp(firebaseConfig);


const auth =
    getAuth(app);


const db =
    getFirestore(app);


/* =========================================================
   WebRTC
========================================================= */

let peerConnection = null;

let localStream = null;

let remoteStream = null;

let activeCallId = null;

let currentUser = null;

let callListeners = [];


/* =========================================================
   إعداد WebRTC
========================================================= */

const rtcConfig = {

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

};


/* =========================================================
   انتظار تسجيل الدخول
========================================================= */

function waitForUser(){

    return new Promise(
        resolve => {

            if(auth.currentUser){

                currentUser =
                    auth.currentUser;

                resolve(
                    auth.currentUser
                );

                return;

            }


            const unsubscribe =
                onAuthStateChanged(
                    auth,
                    user => {

                        if(user){

                            currentUser =
                                user;

                            unsubscribe();

                            resolve(user);

                        }

                    }
                );

        }
    );

}


/* =========================================================
   بدء المكالمة من chat.html
========================================================= */

export async function startCall({

    friendId,

    friendName,

    friendPhoto

}){

    const user =
        await waitForUser();


    if(!user){

        throw new Error(
            "يجب تسجيل الدخول أولاً"
        );

    }


    if(!friendId){

        throw new Error(
            "لم يتم تحديد الصديق"
        );

    }


    /*
       نفتح صفحة الاتصال فورًا
    */

    const params =
        new URLSearchParams();

    params.set(
        "type",
        "outgoing"
    );

    params.set(
        "friend",
        friendId
    );

    params.set(
        "name",
        friendName || "مستخدم Mecd"
    );

    if(friendPhoto){

        params.set(
            "photo",
            friendPhoto
        );

    }


    /*
       حفظ بيانات الاتصال مؤقتًا
       حتى تبدأ صفحة call.html الاتصال
    */

    sessionStorage.setItem(

        "mecdOutgoingCall",

        JSON.stringify({

            friendId,
            friendName:
                friendName ||
                "مستخدم Mecd",

            friendPhoto:
                friendPhoto || ""

        })

    );


    window.location.href =
        "./call.html?" +
        params.toString();

}


/* =========================================================
   إنشاء اتصال WebRTC
========================================================= */

function createPeerConnection(){

    peerConnection =
        new RTCPeerConnection(
            rtcConfig
        );


    peerConnection.ontrack =
        event => {

            const audio =
                document.getElementById(
                    "remoteAudio"
                );

            if(audio){

                audio.srcObject =
                    event.streams[0];

                audio.play()
                    .catch(
                        () => {}
                    );

            }

        };


    peerConnection.onconnectionstatechange =
        () => {

            const state =
                peerConnection
                    .connectionState;


            if(
                state === "connected"
            ){

                window.dispatchEvent(
                    new CustomEvent(
                        "mecd-call-connected"
                    )
                );

            }


            if(
                state === "disconnected" ||
                state === "failed" ||
                state === "closed"
            ){

                window.dispatchEvent(
                    new CustomEvent(
                        "mecd-call-ended"
                    )
                );

            }

        };


    return peerConnection;

}


/* =========================================================
   الميكروفون
========================================================= */

async function getMicrophone(){

    if(localStream){

        return localStream;

    }


    localStream =
        await navigator.mediaDevices
            .getUserMedia({

                audio:true,

                video:false

            });


    return localStream;

}


/* =========================================================
   المتصل
========================================================= */

export async function makeOutgoingCall({

    friendId,
    friendName,
    friendPhoto

}){

    const user =
        await waitForUser();


    activeCallId =
        crypto.randomUUID();


    const callRef =
        doc(
            db,
            "calls",
            activeCallId
        );


    await setDoc(
        callRef,
        {

            callerId:
                user.uid,

            callerName:
                user.displayName ||
                "مستخدم Mecd",

            callerPhoto:
                user.photoURL ||
                "",

            receiverId:
                friendId,

            receiverName:
                friendName ||
                "مستخدم Mecd",

            receiverPhoto:
                friendPhoto ||
                "",

            status:
                "ringing",

            createdAt:
                serverTimestamp()

        }
    );


    await getMicrophone();


    createPeerConnection();


    localStream
        .getTracks()
        .forEach(
            track => {

                peerConnection
                    .addTrack(
                        track,
                        localStream
                    );

            }
        );


    const offer =
        await peerConnection
            .createOffer();


    await peerConnection
        .setLocalDescription(
            offer
        );


    await updateDoc(

        callRef,

        {

            offer:{

                type:
                    offer.type,

                sdp:
                    offer.sdp

            }

        }

    );


    /*
       ICE للمتصل
    */

    const callerCandidates =
        collection(
            callRef,
            "callerCandidates"
        );


    peerConnection.onicecandidate =
        async event => {

            if(
                event.candidate
            ){

                await addDoc(

                    callerCandidates,

                    event.candidate
                        .toJSON()

                );

            }

        };


    /*
       انتظار رد الطرف الآخر
    */

    const unsubscribeCall =
        onSnapshot(

            callRef,

            async snap => {

                if(!snap.exists()){

                    return;

                }


                const data =
                    snap.data();


                if(
                    data.answer &&
                    !peerConnection
                        .currentRemoteDescription
                ){

                    await peerConnection
                        .setRemoteDescription(

                            new RTCSessionDescription(
                                data.answer
                            )

                        );

                }


                if(
                    data.status ===
                    "rejected"
                ){

                    window.dispatchEvent(
                        new CustomEvent(
                            "mecd-call-rejected"
                        )
                    );

                }


                if(
                    data.status ===
                    "ended"
                ){

                    cleanupCall();

                }

            }

        );


    callListeners.push(
        unsubscribeCall
    );


    /*
       ICE القادم من المستقبل
    */

    const receiverCandidates =
        collection(
            callRef,
            "receiverCandidates"
        );


    const unsubscribeCandidates =
        onSnapshot(

            receiverCandidates,

            snapshot => {

                snapshot.docChanges()
                    .forEach(
                        change => {

                            if(
                                change.type ===
                                "added"
                            ){

                                const candidate =
                                    change.doc.data();

                                peerConnection
                                    .addIceCandidate(

                                        new RTCIceCandidate(
                                            candidate
                                        )

                                    )
                                    .catch(
                                        console.error
                                    );

                            }

                        }
                    );

            }

        );


    callListeners.push(
        unsubscribeCandidates
    );


    return activeCallId;

}


/* =========================================================
   قبول المكالمة
========================================================= */

export async function acceptCall(callId){

    const user =
        await waitForUser();


    activeCallId =
        callId;


    const callRef =
        doc(
            db,
            "calls",
            callId
        );


    const snap =
        await getDoc(
            callRef
        );


    if(!snap.exists()){

        throw new Error(
            "المكالمة غير موجودة"
        );

    }


    const data =
        snap.data();


    if(
        data.receiverId !==
        user.uid
    ){

        throw new Error(
            "هذه المكالمة ليست لك"
        );

    }


    await getMicrophone();


    createPeerConnection();


    localStream
        .getTracks()
        .forEach(
            track => {

                peerConnection
                    .addTrack(
                        track,
                        localStream
                    );

            }
        );


    await peerConnection
        .setRemoteDescription(

            new RTCSessionDescription(
                data.offer
            )

        );


    const answer =
        await peerConnection
            .createAnswer();


    await peerConnection
        .setLocalDescription(
            answer
        );


    await updateDoc(

        callRef,

        {

            answer:{

                type:
                    answer.type,

                sdp:
                    answer.sdp

            },

            status:
                "connected",

            answeredAt:
                serverTimestamp()

        }

    );


    /*
       ICE للمستقبل
    */

    const receiverCandidates =
        collection(
            callRef,
            "receiverCandidates"
        );


    peerConnection.onicecandidate =
        async event => {

            if(
                event.candidate
            ){

                await addDoc(

                    receiverCandidates,

                    event.candidate
                        .toJSON()

                );

            }

        };


    /*
       ICE القادم من المتصل
    */

    const callerCandidates =
        collection(
            callRef,
            "callerCandidates"
        );


    const unsubscribeCandidates =
        onSnapshot(

            callerCandidates,

            snapshot => {

                snapshot.docChanges()
                    .forEach(
                        change => {

                            if(
                                change.type ===
                                "added"
                            ){

                                const candidate =
                                    change.doc.data();

                                peerConnection
                                    .addIceCandidate(

                                        new RTCIceCandidate(
                                            candidate
                                        )

                                    )
                                    .catch(
                                        console.error
                                    );

                            }

                        }
                    );

            }

        );


    callListeners.push(
        unsubscribeCandidates
    );


    return true;

}


/* =========================================================
   رفض المكالمة
========================================================= */

export async function rejectCall(callId){

    const callRef =
        doc(
            db,
            "calls",
            callId
        );


    try{

        await updateDoc(

            callRef,

            {

                status:
                    "rejected",

                endedAt:
                    serverTimestamp()

            }

        );

    }catch(error){

        console.error(
            "Reject call:",
            error
        );

    }

}


/* =========================================================
   إنهاء المكالمة
========================================================= */

export async function endCall(){

    if(activeCallId){

        try{

            await updateDoc(

                doc(
                    db,
                    "calls",
                    activeCallId
                ),

                {

                    status:
                        "ended",

                    endedAt:
                        serverTimestamp()

                }

            );

        }catch(error){

            console.error(
                "End call:",
                error
            );

        }

    }


    cleanupCall();

}


/* =========================================================
   تنظيف الاتصال
========================================================= */

export function cleanupCall(){

    callListeners.forEach(
        unsubscribe => {

            try{

                unsubscribe();

            }catch{}

        }
    );


    callListeners =
        [];


    if(peerConnection){

        peerConnection
            .close();

        peerConnection =
            null;

    }


    if(localStream){

        localStream
            .getTracks()
            .forEach(
                track => {

                    track.stop();

                }
            );

        localStream =
            null;

    }


    activeCallId =
        null;

}


/* =========================================================
   تصدير الأدوات
========================================================= */

export {
    db,
    auth
};
