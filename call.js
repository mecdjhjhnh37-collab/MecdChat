// ============================================================
// Mecd Chat - call.js
// نظام مكالمات صوتية WebRTC + Firebase Firestore
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
    serverTimestamp,
    runTransaction
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
// الحالة العامة
// ============================================================

let currentUser = null;

let currentCallId = null;

let currentCallRef = null;

let peerConnection = null;

let localStream = null;

let remoteStream = null;

let unsubscribeCall = null;

let unsubscribeCandidates = null;

let callStartedAt = null;

let timerInterval = null;

let timerSeconds = 0;

let isConnected = false;

let isEnding = false;


// ============================================================
// تسجيل الدخول
// ============================================================

function getCurrentUser(){

    return auth.currentUser;

}


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


function wait(ms){

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}


function formatDuration(seconds){

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


// ============================================================
// الحصول على بيانات المستخدم
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
// الحصول على الميكروفون
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

                echoCancellation:true,

                noiseSuppression:true,

                autoGainControl:true

            },

            video:false

        });


    return localStream;

}


// ============================================================
// إنشاء PeerConnection
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

            event.streams[0]
                ?.getTracks()
                .forEach(
                    track => {

                        remoteStream.addTrack(
                            track
                        );

                    }
                );


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
                state === "failed" ||
                state === "disconnected"
            ){

                if(
                    typeof window.onCallFailed ===
                    "function"
                ){

                    window.onCallFailed();

                }

            }


            if(
                state === "closed"
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
                    !existing.includes(
                        track
                    )
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
// ICE
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
// كتابة ICE
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
// إنشاء المكالمة
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


    currentCallId =
        callId;


    currentCallRef =
        doc(
            db,
            "calls",
            callId
        );


    // --------------------------------------------
    // فتح شاشة المكالمة فورًا
    // --------------------------------------------

    const callUrl =
        "call.html" +

        "?callId=" +
        encodeURIComponent(
            callId
        ) +

        "&mode=outgoing" +

        "&name=" +
        encodeURIComponent(
            friendName
        ) +

        "&photo=" +
        encodeURIComponent(
            friendPhoto
        );


    window.location.href =
        callUrl;


    // باقي العمل يتم من call.html
}


// ============================================================
// تشغيل المتصل بعد فتح call.html
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


    await getLocalAudio();


    createPeerConnection();

    addLocalTracks();


    setupLocalIce(
        "callerCandidates"
    );


    const offer =
        await peerConnection
            .createOffer({

                offerToReceiveAudio:true

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
                getQueryParam(
                    "friendId"
                ) || "",

            callerName:
                getQueryParam(
                    "name"
                ) || "مستخدم Mecd",

            callerPhoto:
                getQueryParam(
                    "photo"
                ) || "",

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
                0

        }

    );


    // --------------------------------------------
    // مراقبة حالة المكالمة
    // --------------------------------------------

    unsubscribeCall =
        onSnapshot(

            currentCallRef,

            async snapshot => {

                if(!snapshot.exists()){

                    return;

                }


                const data =
                    snapshot.data();


                // --------------------------------
                // الطرف الثاني بدأ الرنين فعليًا
                // --------------------------------

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


                // --------------------------------
                // تم الرفض
                // --------------------------------

                if(
                    data.status ===
                    "rejected"
                ){

                    if(
                        typeof window.onCallRejected ===
                        "function"
                    ){

                        window.onCallRejected();

                    }

                    await finishLocalCall(
                        "rejected"
                    );

                }


                // --------------------------------
                // تم إنهاء المكالمة
                // --------------------------------

                if(
                    data.status ===
                    "ended"
                ){

                    if(
                        typeof window.onCallEnded ===
                        "function"
                    ){

                        window.onCallEnded();

                    }

                    await cleanupCall(
                        callId,
                        false
                    );

                }


                // --------------------------------
                // وصل الرد
                // --------------------------------

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


                        // --------------------------------
                        // إذا نحن أصلًا داخل مكالمة
                        // --------------------------------

                        if(
                            currentCallId
                        ){

                            return;

                        }


                        // --------------------------------
                        // فتح شاشة المكالمة الواردة
                        // --------------------------------

                        const url =
                            "call.html" +

                            "?callId=" +
                            encodeURIComponent(
                                callId
                            ) +

                            "&mode=incoming" +

                            "&name=" +
                            encodeURIComponent(
                                data.callerName ||
                                "مستخدم Mecd"
                            ) +

                            "&photo=" +
                            encodeURIComponent(
                                data.callerPhoto ||
                                ""
                            );


                        window.location.href =
                            url;

                    }
                );

        },

        error => {

            console.error(
                "Incoming calls listener:",
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
        data.status !==
        "calling"
    ){

        throw new Error(
            "المكالمة انتهت"
        );

    }


    // --------------------------------------------
    // إنشاء الاتصال
    // --------------------------------------------

    await getLocalAudio();


    createPeerConnection();

    addLocalTracks();


    setupLocalIce(
        "calleeCandidates"
    );


    listenForIceCandidates(
        "callerCandidates"
    );


    // --------------------------------------------
    // هنا فقط نقول للمتصل: الهاتف الثاني يرن
    // --------------------------------------------

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


    // --------------------------------------------
    // الاستماع للـ offer
    // --------------------------------------------

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

                    if(
                        typeof window.onCallEnded ===
                        "function"
                    ){

                        window.onCallEnded();

                    }

                    return;

                }


                if(
                    call.offer &&
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


    if(!data.offer){

        throw new Error(
            "لم يصل طلب الاتصال بعد"
        );

    }


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
// عند نجاح الاتصال
// ============================================================

async function markConnected(){

    if(isConnected){

        return;

    }


    isConnected =
        true;


    const now =
        Date.now();


    callStartedAt =
        now;


    timerSeconds =
        0;


    startTimer();


    if(
        currentCallRef
    ){

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
                "StartedAt error:",
                error
            );

        }

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
            formatDuration(
                0
            )
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
// كتم ميكروفون الهاتف
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
// كتم صوت الطرف الآخر
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
// إنهاء المكالمة
// ============================================================

export async function endCall(
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


    try{

        await updateDoc(

            ref,

            {

                status:
                    "ended",

                endedAt:
                    serverTimestamp(),

                duration:
                    timerSeconds

            }

        );

    }catch(error){

        console.error(
            "End call error:",
            error
        );

    }


    await addCallHistoryOnce(
        id
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


    await addCallHistoryOnce(
        id
    );

}


// ============================================================
// سجل المكالمة داخل المحادثة
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


        let shouldCreate =
            false;


        await runTransaction(

            db,

            async transaction => {

                const snap =
                    await transaction.get(
                        callRef
                    );


                if(!snap.exists()){

                    return;

                }


                const data =
                    snap.data();


                if(
                    data.historyAdded ===
                    true
                ){

                    return;

                }


                transaction.update(

                    callRef,

                    {

                        historyAdded:
                            true

                    }

                );


                shouldCreate =
                    true;

            }

        );


        if(!shouldCreate){

            return;

        }


        const data =
            (
                await getDoc(
                    callRef
                )
            ).data();


        if(
            !data ||
            !data.callerId ||
            !data.calleeId
        ){

            return;

        }


        const duration =
            Number(
                data.duration ||
                timerSeconds ||
                0
            );


        let status =
            "completed";


        if(
            data.status ===
            "rejected"
        ){

            status =
                "missed";

        }


        if(
            data.status ===
            "ended" &&
            !data.startedAt &&
            !isConnected
        ){

            status =
                "missed";

        }


        const caller =
            data.callerId;


        const callee =
            data.calleeId;


        const chatId =
            [
                caller,
                callee
            ]
            .sort()
            .join("_");


        await addDoc(

            collection(
                db,
                "chats",
                chatId,
                "messages"
            ),

            {

                type:
                    "call",

                callStatus:
                    status,

                callDirection:
                    currentUser?.uid ===
                    caller
                    ?
                    "outgoing"
                    :
                    "incoming",

                duration:
                    duration,

                callerId:
                    caller,

                receiverId:
                    callee,

                senderId:
                    currentUser?.uid ||
                    caller,

                text:
                    status === "missed"
                    ?
                    "مكالمة لم يتم الرد عليها"
                    :
                    "مكالمة صوتية",

                createdAt:
                    serverTimestamp()

            }

        );

    }catch(error){

        console.error(
            "Call history error:",
            error
        );

    }

}


// ============================================================
// تنظيف
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


    if(writeHistory && id){

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

        window.onCallCleanup();

    }

}


// ============================================================
// إنهاء محلي
// ============================================================

async function finishLocalCall(
    reason
){

    stopTimer();


    if(
        typeof window.onCallEnded ===
        "function"
    ){

        window.onCallEnded(
            reason
        );

    }


    await cleanupCall(
        currentCallId,
        true
    );

}


// ============================================================
// حذف حالة المكالمة الواردة
// ============================================================

export async function clearIncomingCall(){

    // لا نحذف سجل المكالمة.
    // فقط ننظف الحالة المحلية.

    currentCallId =
        null;

}


// ============================================================
// بارامترات الرابط
// ============================================================

function getQueryParam(
    name
){

    return new URLSearchParams(
        location.search
    ).get(name) || "";

}


// ============================================================
// تصدير الوصول للصوت
// ============================================================

export function getLocalStream(){

    return localStream;

}


// ============================================================
// عند فتح call.html
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
// تجهيز الاتصال الوارد تلقائيًا
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
