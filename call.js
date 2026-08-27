// ============================================================
// Mecd Chat - call.js
// WebRTC Voice Call + Firebase Firestore
// ============================================================

import {
    getApps,
    getApp,
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    setDoc,
    updateDoc,
    getDoc,
    addDoc,
    query,
    where,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// ============================================================
// Firebase
// ============================================================

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


const firebaseApp =
    getApps().length
        ? getApp()
        : initializeApp(firebaseConfig);


const auth =
    getAuth(firebaseApp);


const db =
    getFirestore(firebaseApp);


// ============================================================
// WebRTC
// ============================================================

const RTC_CONFIG = {

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


// ============================================================
// إعدادات
// ============================================================

const RING_TIMEOUT = 30000;


// ============================================================
// الحالة
// ============================================================

let currentUser = null;

let currentCallId = null;

let currentCallRef = null;

let peerConnection = null;

let localStream = null;

let remoteStream = null;

let unsubscribeCall = null;

let unsubscribeCandidates = null;

let timerInterval = null;

let callTimeoutTimer = null;

let timerSeconds = 0;

let isConnected = false;

let isEnding = false;

let callEndNotified = false;


// ============================================================
// تسجيل الدخول
// ============================================================

if(auth.currentUser){

    currentUser =
        auth.currentUser;

}else{

    onAuthStateChanged(
        auth,
        user => {

            currentUser =
                user;

        }
    );

}


// ============================================================
// أدوات
// ============================================================

function createCallId(){

    return [

        Date.now().toString(36),

        Math.random()
            .toString(36)
            .slice(2,10)

    ].join("-");

}


function formatDuration(seconds){

    seconds =
        Number(seconds || 0);

    if(!Number.isFinite(seconds)){

        seconds = 0;

    }

    seconds =
        Math.max(
            0,
            Math.floor(seconds)
        );


    const hours =
        Math.floor(
            seconds / 3600
        );


    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );


    const secs =
        seconds % 60;


    if(hours > 0){

        return (

            String(hours)
                .padStart(2,"0")

            + ":" +

            String(minutes)
                .padStart(2,"0")

            + ":" +

            String(secs)
                .padStart(2,"0")

        );

    }


    return (

        String(minutes)
            .padStart(2,"0")

        + ":" +

        String(secs)
            .padStart(2,"0")

    );

}


function getQueryParam(name){

    return new URLSearchParams(
        location.search
    ).get(name) || "";

}


// ============================================================
// إعلام الواجهة بانتهاء المكالمة
// ============================================================

function notifyCallEnded(reason){

    if(callEndNotified){

        return;

    }


    callEndNotified =
        true;


    if(
        typeof window.onCallEnded ===
        "function"
    ){

        try{

            window.onCallEnded(
                reason
            );

        }catch(error){

            console.error(
                "onCallEnded error:",
                error
            );

        }

    }

}


// ============================================================
// العودة للدردشة
// ============================================================

function returnToChat(){

    const returnUrl =
        getQueryParam("return");


    if(returnUrl){

        setTimeout(
            () => {

                try{

                    window.location.replace(
                        returnUrl
                    );

                }catch(error){

                    console.error(
                        "Return chat error:",
                        error
                    );

                    history.back();

                }

            },
            150
        );

        return;

    }


    if(
        document.referrer &&
        document.referrer !== location.href
    ){

        setTimeout(
            () => {

                history.back();

            },
            150
        );

    }

}


// ============================================================
// المستخدم
// ============================================================

async function ensureUser(){

    let user =
        auth.currentUser;


    if(user){

        currentUser =
            user;

        return user;

    }


    return new Promise(
        (resolve,reject) => {

            const unsubscribe =
                onAuthStateChanged(

                    auth,

                    user => {

                        unsubscribe();


                        if(!user){

                            reject(
                                new Error(
                                    "يجب تسجيل الدخول أولاً"
                                )
                            );

                            return;

                        }


                        currentUser =
                            user;


                        resolve(user);

                    }

                );

        }
    );

}


// ============================================================
// الميكروفون
// ============================================================

async function getLocalAudio(){

    if(localStream){

        return localStream;

    }


    if(
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ){

        throw new Error(
            "المتصفح لا يدعم الميكروفون"
        );

    }


    localStream =
        await navigator.mediaDevices.getUserMedia({

            audio: {

                echoCancellation:
                    true,

                noiseSuppression:
                    true,

                autoGainControl:
                    true

            },

            video:false

        });


    return localStream;

}


// ============================================================
// PeerConnection
// ============================================================

function createPeerConnection(){

    if(peerConnection){

        return peerConnection;

    }


    peerConnection =
        new RTCPeerConnection(
            RTC_CONFIG
        );


    remoteStream =
        new MediaStream();


    peerConnection.ontrack =
        event => {

            if(event.streams[0]){

                event.streams[0]
                    .getTracks()
                    .forEach(
                        track => {

                            if(
                                !remoteStream
                                    .getTracks()
                                    .includes(track)
                            ){

                                remoteStream.addTrack(
                                    track
                                );

                            }

                        }
                    );

            }


            if(
                typeof window.onRemoteStream ===
                "function"
            ){

                window.onRemoteStream(
                    remoteStream
                );

            }

        };


    peerConnection.onconnectionstatechange =
        async () => {

            const state =
                peerConnection
                    ?.connectionState;


            console.log(
                "WebRTC state:",
                state
            );


            if(
                state ===
                "connected"
            ){

                await markConnected();

            }


            if(
                state ===
                "failed"
            ){

                if(
                    typeof window.onCallFailed ===
                    "function"
                ){

                    window.onCallFailed();

                }

            }


            if(
                state ===
                "disconnected"
            ){

                if(
                    typeof window.onCallFailed ===
                    "function"
                ){

                    window.onCallFailed();

                }

            }


            if(
                state ===
                "closed"
            ){

                stopTimer();

            }

        };


    return peerConnection;

}


// ============================================================
// إضافة الصوت المحلي
// ============================================================

function addLocalTracks(){

    if(
        !peerConnection ||
        !localStream
    ){

        return;

    }


    const existing =
        peerConnection
            .getSenders()
            .map(
                sender =>
                    sender.track
            );


    localStream
        .getTracks()
        .forEach(
            track => {

                if(
                    !existing.includes(track)
                ){

                    peerConnection.addTrack(
                        track,
                        localStream
                    );

                }

            }
        );

}


// ============================================================
// استقبال ICE
// ============================================================

function listenForIceCandidates(
    collectionName
){

    if(unsubscribeCandidates){

        unsubscribeCandidates();

        unsubscribeCandidates =
            null;

    }


    if(!currentCallRef){

        return;

    }


    const candidatesRef =
        collection(
            currentCallRef,
            collectionName
        );


    unsubscribeCandidates =
        onSnapshot(

            candidatesRef,

            snapshot => {

                snapshot.docChanges()
                    .forEach(
                        async change => {

                            if(
                                change.type !==
                                "added"
                            ){

                                return;

                            }


                            const data =
                                change.doc.data();


                            if(
                                !data.candidate
                            ){

                                return;

                            }


                            try{

                                if(
                                    peerConnection
                                ){

                                    await peerConnection
                                        .addIceCandidate(

                                            new RTCIceCandidate(
                                                data.candidate
                                            )

                                        );

                                }

                            }catch(error){

                                console.error(
                                    "ICE error:",
                                    error
                                );

                            }

                        }
                    );

            },

            error => {

                console.error(
                    "ICE listener:",
                    error
                );

            }

        );

}


// ============================================================
// إرسال ICE
// ============================================================

function setupLocalIce(
    collectionName
){

    if(
        !peerConnection ||
        !currentCallRef
    ){

        return;

    }


    peerConnection.onicecandidate =
        async event => {

            if(
                !event.candidate
            ){

                return;

            }


            try{

                await addDoc(

                    collection(
                        currentCallRef,
                        collectionName
                    ),

                    {

                        candidate:
                            event.candidate.toJSON(),

                        createdAt:
                            serverTimestamp()

                    }

                );

            }catch(error){

                console.error(
                    "ICE save error:",
                    error
                );

            }

        };

}


// ============================================================
// بدء المكالمة
// ============================================================

export async function startCall({

    friendId,

    friendName = "مستخدم Mecd",

    friendPhoto = ""

}){

    if(!friendId){

        throw new Error(
            "لم يتم تحديد الصديق"
        );

    }


    const user =
        await ensureUser();


    if(
        friendId ===
        user.uid
    ){

        throw new Error(
            "لا يمكنك الاتصال بنفسك"
        );

    }


    const callId =
        createCallId();


    const returnUrl =
        "chat.html?friend=" +
        encodeURIComponent(
            friendId
        );


    const callUrl =
        "call.html" +

        "?callId=" +
        encodeURIComponent(
            callId
        ) +

        "&mode=outgoing" +

        "&friendId=" +
        encodeURIComponent(
            friendId
        ) +

        "&name=" +
        encodeURIComponent(
            friendName
        ) +

        "&photo=" +
        encodeURIComponent(
            friendPhoto
        ) +

        "&return=" +
        encodeURIComponent(
            returnUrl
        );


    window.location.href =
        callUrl;

}


// ============================================================
// مؤقت عدم الرد
// ============================================================

function startNoAnswerTimeout(
    callId,
    createdAtMs
){

    clearCallTimeout();


    const elapsed =
        Math.max(
            0,
            Date.now() -
            (
                createdAtMs ||
                Date.now()
            )
        );


    const remaining =
        Math.max(
            0,
            RING_TIMEOUT -
            elapsed
        );


    console.log(
        "⏱️ الرنين:",
        Math.ceil(
            remaining / 1000
        ),
        "ثانية"
    );


    callTimeoutTimer =
        setTimeout(

            async () => {

                if(
                    !currentCallRef ||
                    currentCallId !== callId ||
                    isConnected ||
                    isEnding
                ){

                    return;

                }


                try{

                    const snapshot =
                        await getDoc(
                            currentCallRef
                        );


                    if(
                        !snapshot.exists()
                    ){

                        return;

                    }


                    const data =
                        snapshot.data();


                    if(
                        data.status === "calling" ||
                        data.status === "ringing"
                    ){

                        console.log(
                            "⏰ انتهت 30 ثانية بدون رد"
                        );


                        await endCall(
                            callId,
                            "timeout"
                        );

                    }

                }catch(error){

                    console.error(
                        "Timeout error:",
                        error
                    );

                }

            },

            remaining

        );

}


function clearCallTimeout(){

    if(callTimeoutTimer){

        clearTimeout(
            callTimeoutTimer
        );

        callTimeoutTimer =
            null;

    }

}


// ============================================================
// المتصل
// ============================================================

export async function startOutgoingCall(
    callId
){

    const user =
        await ensureUser();


    currentCallId =
        callId;


    currentCallRef =
        doc(
            db,
            "calls",
            callId
        );


    isConnected =
        false;

    isEnding =
        false;

    callEndNotified =
        false;

    timerSeconds =
        0;


    const friendId =
        getQueryParam(
            "friendId"
        );


    if(!friendId){

        throw new Error(
            "friendId غير موجود"
        );

    }


    const callerName =
        getQueryParam("name") ||
        "مستخدم Mecd";


    const callerPhoto =
        getQueryParam("photo") ||
        "";


    const createdAtMs =
        Date.now();


    await getLocalAudio();


    createPeerConnection();

    addLocalTracks();


    setupLocalIce(
        "callerCandidates"
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


    await setDoc(

        currentCallRef,

        {

            callerId:
                user.uid,

            calleeId:
                friendId,

            callerName:
                callerName,

            callerPhoto:
                callerPhoto,

            offer:{

                type:
                    offer.type,

                sdp:
                    offer.sdp

            },

            status:
                "calling",

            createdAt:
                serverTimestamp(),

            answeredAt:
                null,

            startedAt:
                null,

            endedAt:
                null,

            duration:
                0,

            historyAdded:
                false

        }

    );


    startNoAnswerTimeout(
        callId,
        createdAtMs
    );


    unsubscribeCall =
        onSnapshot(

            currentCallRef,

            async snapshot => {

                if(!snapshot.exists()){

                    return;

                }


                const data =
                    snapshot.data();


                if(
                    data.status ===
                    "ringing"
                ){

                    if(
                        typeof window.onCallRinging ===
                        "function"
                    ){

                        window.onCallRinging();

                    }

                }


                if(
                    data.status ===
                    "accepted"
                ){

                    clearCallTimeout();

                }


                if(
                    data.status ===
                    "connected"
                ){

                    clearCallTimeout();

                }


                if(
                    data.status ===
                    "rejected"
                ){

                    clearCallTimeout();


                    if(
                        typeof window.onCallRejected ===
                        "function"
                    ){

                        window.onCallRejected();

                    }


                    notifyCallEnded(
                        "rejected"
                    );


                    await cleanupCall(
                        callId,
                        false
                    );

                }


                if(
                    data.status ===
                    "ended"
                ){

                    clearCallTimeout();


                    notifyCallEnded(
                        "ended"
                    );


                    await cleanupCall(
                        callId,
                        false
                    );

                }


                if(
                    data.answer &&
                    peerConnection &&
                    !peerConnection
                        .currentRemoteDescription
                ){

                    try{

                        await peerConnection
                            .setRemoteDescription(

                                new RTCSessionDescription(
                                    data.answer
                                )

                            );

                    }catch(error){

                        console.error(
                            "Answer error:",
                            error
                        );

                    }

                }

            },

            error => {

                console.error(
                    "Call listener:",
                    error
                );

            }

        );


    listenForIceCandidates(
        "calleeCandidates"
    );

}


// ============================================================
// استقبال المكالمات
// ============================================================

let incomingListenerStarted =
    false;


export async function listenIncomingCalls(){

    if(incomingListenerStarted){

        return;

    }


    const user =
        await ensureUser();


    incomingListenerStarted =
        true;


    const q =
        query(

            collection(
                db,
                "calls"
            ),

            where(
                "calleeId",
                "==",
                user.uid
            ),

            where(
                "status",
                "==",
                "calling"
            )

        );


    onSnapshot(

        q,

        snapshot => {

            snapshot.docChanges()
                .forEach(
                    change => {

                        if(
                            change.type !==
                            "added"
                        ){

                            return;

                        }


                        const data =
                            change.doc.data();


                        const callId =
                            change.doc.id;


                        if(
                            !data.callerId ||
                            data.callerId ===
                            user.uid
                        ){

                            return;

                        }


                        if(currentCallId){

                            return;

                        }


                        const returnUrl =
                            "chat.html?friend=" +
                            encodeURIComponent(
                                data.callerId
                            );


                        const url =
                            "call.html" +

                            "?callId=" +
                            encodeURIComponent(
                                callId
                            ) +

                            "&mode=incoming" +

                            "&friendId=" +
                            encodeURIComponent(
                                data.callerId
                            ) +

                            "&name=" +
                            encodeURIComponent(
                                data.callerName ||
                                "مستخدم Mecd"
                            ) +

                            "&photo=" +
                            encodeURIComponent(
                                data.callerPhoto ||
                                ""
                            ) +

                            "&return=" +
                            encodeURIComponent(
                                returnUrl
                            );


                        window.location.href =
                            url;

                    }
                );

        },

        error => {

            console.error(
                "Incoming calls error:",
                error
            );

        }

    );

}


// ============================================================
// تجهيز المكالمة الواردة
// ============================================================

export async function watchIncomingCall(
    callId
){

    await ensureUser();


    currentCallId =
        callId;


    currentCallRef =
        doc(
            db,
            "calls",
            callId
        );


    isConnected =
        false;

    isEnding =
        false;

    callEndNotified =
        false;

    timerSeconds =
        0;


    const snapshot =
        await getDoc(
            currentCallRef
        );


    if(!snapshot.exists()){

        throw new Error(
            "المكالمة غير موجودة"
        );

    }


    let data =
        snapshot.data();


    if(
        data.status !== "calling" &&
        data.status !== "ringing"
    ){

        throw new Error(
            "المكالمة انتهت"
        );

    }


    await getLocalAudio();


    const latestSnapshot =
        await getDoc(
            currentCallRef
        );


    if(!latestSnapshot.exists()){

        throw new Error(
            "المكالمة انتهت"
        );

    }


    data =
        latestSnapshot.data();


    if(
        data.status !== "calling" &&
        data.status !== "ringing"
    ){

        throw new Error(
            "المكالمة انتهت"
        );

    }


    createPeerConnection();

    addLocalTracks();


    setupLocalIce(
        "calleeCandidates"
    );


    listenForIceCandidates(
        "callerCandidates"
    );


    const createdAtMs =
        data.createdAt?.toMillis?.() ||
        Date.now();


    const elapsed =
        Date.now() -
        createdAtMs;


    if(
        elapsed >= RING_TIMEOUT
    ){

        await endCall(
            callId,
            "timeout"
        );

        return;

    }


    await updateDoc(

        currentCallRef,

        {

            status:
                "ringing",

            ringingAt:
                serverTimestamp()

        }

    );


    if(
        typeof window.onIncomingRinging ===
        "function"
    ){

        window.onIncomingRinging();

    }


    startNoAnswerTimeout(
        callId,
        createdAtMs
    );


    unsubscribeCall =
        onSnapshot(

            currentCallRef,

            async snap => {

                if(!snap.exists()){

                    return;

                }


                const call =
                    snap.data();


                if(
                    call.status ===
                    "ended"
                ){

                    clearCallTimeout();


                    notifyCallEnded(
                        "ended"
                    );


                    await cleanupCall(
                        callId,
                        false
                    );


                    return;

                }


                if(
                    call.status ===
                    "rejected"
                ){

                    clearCallTimeout();


                    notifyCallEnded(
                        "rejected"
                    );


                    await cleanupCall(
                        callId,
                        false
                    );


                    return;

                }


                if(
                    call.status ===
                    "accepted"
                ){

                    clearCallTimeout();

                }


                if(
                    call.offer &&
                    peerConnection &&
                    !peerConnection
                        .currentRemoteDescription
                ){

                    try{

                        await peerConnection
                            .setRemoteDescription(

                                new RTCSessionDescription(
                                    call.offer
                                )

                            );

                    }catch(error){

                        console.error(
                            "Offer error:",
                            error
                        );

                    }

                }

            }

        );

}


// ============================================================
// قبول المكالمة
// ============================================================

export async function acceptIncomingCall(
    callId
){

    if(
        !currentCallRef ||
        currentCallId !== callId
    ){

        currentCallId =
            callId;

        currentCallRef =
            doc(
                db,
                "calls",
                callId
            );

    }


    const snapshot =
        await getDoc(
            currentCallRef
        );


    if(!snapshot.exists()){

        throw new Error(
            "المكالمة غير موجودة"
        );

    }


    const data =
        snapshot.data();


    if(
        data.status === "ended" ||
        data.status === "rejected"
    ){

        throw new Error(
            "انتهت المكالمة"
        );

    }


    if(
        data.status !== "calling" &&
        data.status !== "ringing"
    ){

        throw new Error(
            "المكالمة لم تعد متاحة"
        );

    }


    if(!data.offer){

        throw new Error(
            "لم يصل طلب الاتصال بعد"
        );

    }


    clearCallTimeout();


    if(!peerConnection){

        await getLocalAudio();

        createPeerConnection();

        addLocalTracks();

        setupLocalIce(
            "calleeCandidates"
        );

        listenForIceCandidates(
            "callerCandidates"
        );

    }


    if(
        !peerConnection
            .currentRemoteDescription
    ){

        await peerConnection
            .setRemoteDescription(

                new RTCSessionDescription(
                    data.offer
                )

            );

    }


    const answer =
        await peerConnection
            .createAnswer();


    await peerConnection
        .setLocalDescription(
            answer
        );


    await updateDoc(

        currentCallRef,

        {

            answer:{

                type:
                    answer.type,

                sdp:
                    answer.sdp

            },

            status:
                "accepted",

            answeredAt:
                serverTimestamp()

        }

    );


    return true;

}


// ============================================================
// اتصال فعلي
// ============================================================

async function markConnected(){

    if(
        isConnected ||
        isEnding ||
        !currentCallRef
    ){

        return;

    }


    try{

        const snapshot =
            await getDoc(
                currentCallRef
            );


        if(!snapshot.exists()){

            return;

        }


        const data =
            snapshot.data();


        if(
            data.status === "ended" ||
            data.status === "rejected"
        ){

            return;

        }

    }catch(error){

        console.error(
            "Connection check error:",
            error
        );

        return;

    }


    isConnected =
        true;


    clearCallTimeout();


    timerSeconds =
        0;


    startTimer();


    try{

        await updateDoc(

            currentCallRef,

            {

                status:
                    "connected",

                startedAt:
                    serverTimestamp()

            }

        );

    }catch(error){

        console.error(
            "Connected update error:",
            error
        );

    }


    if(
        typeof window.onCallConnected ===
        "function"
    ){

        window.onCallConnected();

    }

}


// ============================================================
// المؤقت
// ============================================================

function startTimer(){

    stopTimer();


    timerSeconds =
        0;


    if(
        typeof window.onCallTimer ===
        "function"
    ){

        window.onCallTimer(
            formatDuration(0)
        );

    }


    timerInterval =
        setInterval(

            () => {

                timerSeconds++;


                if(
                    typeof window.onCallTimer ===
                    "function"
                ){

                    window.onCallTimer(
                        formatDuration(
                            timerSeconds
                        )
                    );

                }

            },

            1000

        );

}


function stopTimer(){

    if(timerInterval){

        clearInterval(
            timerInterval
        );

        timerInterval =
            null;

    }

}


// ============================================================
// كتم الميكروفون
// ============================================================

export function toggleMute(){

    if(!localStream){

        return false;

    }


    const tracks =
        localStream
            .getAudioTracks();


    if(!tracks.length){

        return false;

    }


    const newState =
        !tracks[0].enabled;


    tracks.forEach(
        track => {

            track.enabled =
                newState;

        }
    );


    return !newState;

}


// ============================================================
// كتم الطرف الآخر
// ============================================================

export function toggleRemoteMute(){

    if(
        typeof window.toggleRemoteAudio ===
        "function"
    ){

        return window.toggleRemoteAudio();

    }


    return false;

}


// ============================================================
// تسجيل سجل المكالمة
// ============================================================

async function addCallHistoryOnce(
    callId
){

    try{

        const callRef =
            doc(
                db,
                "calls",
                callId
            );


        const snapshot =
            await getDoc(
                callRef
            );


        if(!snapshot.exists()){

            return;

        }


        const data =
            snapshot.data();


        if(
            !data.callerId ||
            !data.calleeId
        ){

            return;

        }


        /*
         لا نسجل المكالمة إلا بعد انتهائها
        */

        if(
            data.status !== "ended" &&
            data.status !== "rejected"
        ){

            return;

        }


        let duration =
            Number(
                data.duration || 0
            );


        if(
            !Number.isFinite(duration)
        ){

            duration = 0;

        }


        duration =
            Math.max(
                0,
                Math.floor(duration)
            );


        /*
         تحديد الحالة
        */

        let callStatus =
            "completed";


        if(
            data.status === "rejected"
        ){

            callStatus =
                "missed";

        }


        if(
            data.status === "ended" &&
            !data.startedAt &&
            duration === 0
        ){

            callStatus =
                "missed";

        }


        /*
         ID ثابت لرسالة المكالمة
         حتى لا تتكرر
        */

        const chatId =
            [

                data.callerId,

                data.calleeId

            ]
            .sort()
            .join("_");


        const messageId =
            "call_" +
            callId;


        const messageRef =
            doc(

                db,

                "chats",

                chatId,

                "messages",

                messageId

            );


        const text =
            callStatus === "missed"
            ?
            "مكالمة فائتة"
            :
            "مكالمة صوتية";


        await setDoc(

            messageRef,

            {

                type:
                    "call",

                callStatus:
                    callStatus,

                callDirection:
                    "outgoing",

                duration:
                    duration,

                callerId:
                    data.callerId,

                receiverId:
                    data.calleeId,

                senderId:
                    data.callerId,

                text:
                    text,

                createdAt:
                    data.endedAt ||
                    serverTimestamp()

            },

            {
                merge:true
            }

        );


        /*
         نضع علامة فقط للمعلومية
        */

        try{

            await updateDoc(

                callRef,

                {

                    historyAdded:
                        true

                }

            );

        }catch(error){

            console.warn(
                "historyAdded update:",
                error
            );

        }


        console.log(
            "📞 تم تسجيل سجل المكالمة:",
            callStatus,
            duration
        );

    }catch(error){

        console.error(
            "Call history error:",
            error
        );

    }

}


// ============================================================
// إنهاء المكالمة
// ============================================================

export async function endCall(
    callId,
    reason = "ended"
){

    const id =
        callId ||
        currentCallId;


    if(!id){

        return;

    }


    const ref =
        doc(
            db,
            "calls",
            id
        );


    clearCallTimeout();


    try{

        const snapshot =
            await getDoc(
                ref
            );


        if(snapshot.exists()){

            const data =
                snapshot.data();


            const alreadyFinished =
                data.status === "ended" ||
                data.status === "rejected";


            if(!alreadyFinished){

                /*
                 إذا كان أحد الطرفين متصلًا
                 نحتفظ بأنها مكالمة مكتملة.
                */

                const wasConnected =
                    isConnected ||
                    !!data.startedAt ||
                    data.status === "connected";


                const finalDuration =
                    wasConnected
                    ?
                    Math.max(
                        timerSeconds,
                        Number(
                            data.duration || 0
                        )
                    )
                    :
                    0;


                await updateDoc(

                    ref,

                    {

                        status:
                            "ended",

                        endedAt:
                            serverTimestamp(),

                        duration:
                            finalDuration

                    }

                );

            }

        }

    }catch(error){

        console.error(
            "End call error:",
            error
        );

    }


    /*
     نسجل سجل المكالمة قبل التنظيف
    */

    await addCallHistoryOnce(
        id
    );


    notifyCallEnded(
        reason === "timeout"
        ?
        "timeout"
        :
        "ended"
    );


    await cleanupCall(
        id,
        false
    );

}


// ============================================================
// رفض المكالمة
// ============================================================

export async function rejectCall(
    callId
){

    const id =
        callId ||
        currentCallId;


    if(!id){

        return;

    }


    const ref =
        doc(
            db,
            "calls",
            id
        );


    clearCallTimeout();


    try{

        await updateDoc(

            ref,

            {

                status:
                    "rejected",

                endedAt:
                    serverTimestamp(),

                duration:
                    0

            }

        );

    }catch(error){

        console.error(
            "Reject call error:",
            error
        );

    }


    await addCallHistoryOnce(
        id
    );


    notifyCallEnded(
        "rejected"
    );


    await cleanupCall(
        id,
        false
    );

}


// ============================================================
// تنظيف المكالمة
// ============================================================

export async function cleanupCall(
    callId,
    writeHistory = true
){

    if(isEnding){

        return;

    }


    isEnding =
        true;


    const id =
        callId ||
        currentCallId;


    clearCallTimeout();


    if(
        writeHistory &&
        id
    ){

        await addCallHistoryOnce(
            id
        );

    }


    stopTimer();


    if(unsubscribeCall){

        unsubscribeCall();

        unsubscribeCall =
            null;

    }


    if(unsubscribeCandidates){

        unsubscribeCandidates();

        unsubscribeCandidates =
            null;

    }


    if(localStream){

        localStream
            .getTracks()
            .forEach(
                track => {

                    try{

                        track.stop();

                    }catch(e){}

                }
            );

        localStream =
            null;

    }


    if(peerConnection){

        try{

            peerConnection.close();

        }catch(e){}

        peerConnection =
            null;

    }


    remoteStream =
        null;


    currentCallId =
        null;

    currentCallRef =
        null;


    if(
        typeof window.onCallCleanup ===
        "function"
    ){

        try{

            window.onCallCleanup();

        }catch(error){

            console.error(
                "Cleanup callback error:",
                error
            );

        }

    }


    returnToChat();

}


// ============================================================
// تنظيف المكالمة الواردة
// ============================================================

export async function clearIncomingCall(){

    clearCallTimeout();


    currentCallId =
        null;


    currentCallRef =
        null;

}


// ============================================================
// الحصول على الصوت
// ============================================================

export function getLocalStream(){

    return localStream;

}


// ============================================================
// حالة المكالمة
// ============================================================

export function getCallState(){

    return {

        callId:
            currentCallId,

        connected:
            isConnected,

        duration:
            timerSeconds

    };

}


// ============================================================
// تجهيز الواردة
// ============================================================

export async function initIncomingCall(
    callId
){

    return watchIncomingCall(
        callId
    );

}


// ============================================================
// جاهز
// ============================================================

console.log(
    "🔥 Mecd Call System Ready"
);
