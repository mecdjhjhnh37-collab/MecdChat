// ============================================================
// Mecd Chat - Video Call
// Video-call.js
// ============================================================


// ============================================================
// Firebase
// ============================================================

import {
    initializeApp
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
    collection,
    addDoc,
    onSnapshot,
    serverTimestamp
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


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
    initializeApp(
        firebaseConfig
    );


const auth =
    getAuth(
        firebaseApp
    );


const db =
    getFirestore(
        firebaseApp
    );


// ============================================================
// العناصر
// ============================================================

const $ =
    id =>
        document.getElementById(id);


const loading =
    $("loading");

const remoteVideo =
    $("remoteVideo");

const localVideo =
    $("localVideo");

const remotePlaceholder =
    $("remotePlaceholder");

const remoteAvatar =
    $("remoteAvatar");

const remoteName =
    $("remoteName");

const callStatus =
    $("callStatus");

const topName =
    $("topName");

const topStatus =
    $("topStatus");

const muteButton =
    $("muteButton");

const cameraButton =
    $("cameraButton");

const endButton =
    $("endButton");

const backButton =
    $("backButton");

const errorBox =
    $("errorBox");


// ============================================================
// المتغيرات
// ============================================================

let currentUser =
    null;

let friendUser =
    null;

let callId =
    null;

let peerConnection =
    null;

let localStream =
    null;

let unsubscribeCall =
    null;

let unsubscribeCandidates =
    null;

let ended =
    false;

let microphoneEnabled =
    true;

let cameraEnabled =
    true;

const pendingCandidates =
    [];

const addedCandidateIds =
    new Set();


// ============================================================
// إعداد WebRTC
// ============================================================

const rtcConfiguration = {

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
// URL
// ============================================================

const params =
    new URLSearchParams(
        window.location.search
    );


const friendId =
    params.get(
        "friend"
    );


const incomingCallId =
    params.get(
        "call"
    );


// ============================================================
// إظهار خطأ
// ============================================================

function showError(
    message
){

    console.error(
        message
    );

    loading.classList.add(
        "hidden"
    );

    errorBox.textContent =
        message;

    errorBox.classList.remove(
        "hidden"
    );

    callStatus.textContent =
        "تعذر الاتصال";

    topStatus.textContent =
        "تعذر الاتصال";

}


// ============================================================
// تحديث الحالة
// ============================================================

function setStatus(
    text
){

    callStatus.textContent =
        text;

    topStatus.textContent =
        text;

}


// ============================================================
// بيانات الصديق
// ============================================================

async function loadFriend(){

    if(!friendId){

        return;

    }

    const snap =
        await getDoc(

            doc(
                db,
                "users",
                friendId
            )

        );


    if(
        !snap.exists()
    ){

        throw new Error(
            "المستخدم غير موجود"
        );

    }


    const data =
        snap.data();


    friendUser = {

        uid:
            friendId,

        name:
            data.name ||
            "مستخدم Mecd",

        photo:
            data.photo ||
            ""

    };


    remoteName.textContent =
        friendUser.name;

    topName.textContent =
        friendUser.name;


    if(
        friendUser.photo
    ){

        remoteAvatar.innerHTML =

            '<img src="' +
            escapeHtml(
                friendUser.photo
            ) +
            '" alt="صورة الحساب">';

    }

}


// ============================================================
// حماية HTML
// ============================================================

function escapeHtml(
    value
){

    return String(value)

        .replace(
            /[&<>'"]/g,

            c => ({

                "&":
                    "&amp;",

                "<":
                    "&lt;",

                ">":
                    "&gt;",

                "'":
                    "&#39;",

                '"':
                    "&quot;"

            }[c])

        );

}


// ============================================================
// تشغيل الكاميرا والمايك
// ============================================================

async function getLocalMedia(){

    if(localStream){

        return localStream;

    }


    if(
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ){

        throw new Error(
            "المتصفح لا يدعم الكاميرا والمايك"
        );

    }


    try{

        localStream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    video:{
                        facingMode:"user"
                    },

                    audio:true

                });


    }

    catch(error){

        console.error(
            error
        );

        throw new Error(
            "لم يتم السماح باستخدام الكاميرا والمايك"
        );

    }


    localVideo.srcObject =
        localStream;


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
            rtcConfiguration
        );


    // --------------------------------------------------------
    // إرسال ICE Candidate
    // --------------------------------------------------------

    peerConnection.onicecandidate =
        async event => {

            if(
                !event.candidate ||
                !callId ||
                !currentUser
            ){

                return;

            }


            const collectionName =

                currentUser.uid ===
                getCallerId()

                ?

                "callerCandidates"

                :

                "calleeCandidates";


            try{

                await addDoc(

                    collection(

                        db,

                        "videoCalls",

                        callId,

                        collectionName

                    ),

                    event.candidate.toJSON()

                );

            }

            catch(error){

                console.error(
                    "ICE error:",
                    error
                );

            }

        };


    // --------------------------------------------------------
    // استقبال فيديو الطرف الآخر
    // --------------------------------------------------------

    peerConnection.ontrack =
        event => {

            if(
                event.streams &&
                event.streams[0]
            ){

                remoteVideo.srcObject =
                    event.streams[0];

                remotePlaceholder.classList.add(
                    "hidden"
                );

                setStatus(
                    "متصل"
                );

            }

        };


    // --------------------------------------------------------
    // حالة الاتصال
    // --------------------------------------------------------

    peerConnection.onconnectionstatechange =
        () => {

            if(!peerConnection){

                return;

            }


            const state =
                peerConnection.connectionState;


            console.log(
                "WebRTC:",
                state
            );


            if(
                state ===
                "connected"
            ){

                setStatus(
                    "متصل"
                );

            }


            if(
                state ===
                "connecting"
            ){

                setStatus(
                    "جارٍ الاتصال..."
                );

            }


            if(
                state ===
                "disconnected"
            ){

                setStatus(
                    "انقطع الاتصال"
                );

            }


            if(
                state ===
                "failed"
            ){

                setStatus(
                    "فشل الاتصال"
                );

            }

        };


    return peerConnection;

}


// ============================================================
// الحصول على Caller ID
// ============================================================

let cachedCallerId =
    null;


function getCallerId(){

    return cachedCallerId;

}


// ============================================================
// إضافة local tracks
// ============================================================

function addLocalTracks(){

    if(
        !localStream ||
        !peerConnection
    ){

        return;

    }


    const senders =
        peerConnection
            .getSenders();


    localStream
        .getTracks()
        .forEach(

            track => {

                const alreadyAdded =
                    senders.some(

                        sender =>
                            sender.track &&
                            sender.track.kind ===
                            track.kind

                    );


                if(!alreadyAdded){

                    peerConnection
                        .addTrack(
                            track,
                            localStream
                        );

                }

            }

        );

}


// ============================================================
// إضافة ICE مؤجل
// ============================================================

async function flushPendingCandidates(){

    if(
        !peerConnection ||
        !peerConnection.remoteDescription
    ){

        return;

    }


    while(
        pendingCandidates.length
    ){

        const candidate =
            pendingCandidates.shift();


        try{

            await peerConnection
                .addIceCandidate(
                    candidate
                );

        }

        catch(error){

            console.error(
                "Candidate error:",
                error
            );

        }

    }

}


// ============================================================
// الاستماع لـ ICE
// ============================================================

function listenCandidates(
    collectionName
){

    if(
        unsubscribeCandidates
    ){

        unsubscribeCandidates();

    }


    const ref =
        collection(

            db,

            "videoCalls",

            callId,

            collectionName

        );


    unsubscribeCandidates =
        onSnapshot(

            ref,

            async snapshot => {

                for(
                    const change
                    of snapshot.docChanges()
                ){

                    if(
                        change.type !==
                        "added"
                    ){

                        continue;

                    }


                    if(
                        addedCandidateIds
                            .has(
                                change.doc.id
                            )
                    ){

                        continue;

                    }


                    addedCandidateIds.add(
                        change.doc.id
                    );


                    const data =
                        change.doc.data();


                    const candidate =
                        new RTCIceCandidate(
                            data
                        );


                    if(
                        peerConnection &&
                        peerConnection.remoteDescription
                    ){

                        try{

                            await peerConnection
                                .addIceCandidate(
                                    candidate
                                );

                        }

                        catch(error){

                            console.error(
                                "ICE add error:",
                                error
                            );

                        }

                    }

                    else{

                        pendingCandidates.push(
                            candidate
                        );

                    }

                }

            },

            error => {

                console.error(
                    "Candidate listener:",
                    error
                );

            }

        );

}


// ============================================================
// بدء مكالمة فيديو
// ============================================================

async function startOutgoingCall(){

    if(
        !currentUser ||
        !friendUser
    ){

        throw new Error(
            "بيانات المكالمة غير مكتملة"
        );

    }


    setStatus(
        "جارٍ الاتصال..."
    );


    await getLocalMedia();


    createPeerConnection();

    addLocalTracks();


    const callRef =
        doc(
            collection(
                db,
                "videoCalls"
            )
        );


    callId =
        callRef.id;


    cachedCallerId =
        currentUser.uid;


    // --------------------------------------------------------
    // الاستماع لـ ICE الخاص بالطرف الآخر
    // --------------------------------------------------------

    listenCandidates(
        "calleeCandidates"
    );


    // --------------------------------------------------------
    // إنشاء Offer
    // --------------------------------------------------------

    const offer =
        await peerConnection
            .createOffer({

                offerToReceiveAudio:true,

                offerToReceiveVideo:true

            });


    await peerConnection
        .setLocalDescription(
            offer
        );


    await setDoc(

        callRef,

        {

            callerId:
                currentUser.uid,

            calleeId:
                friendUser.uid,

            callerName:
                currentUser.displayName ||
                currentUser.email ||
                "مستخدم Mecd",

            callerPhoto:
                currentUser.photoURL ||
                "",

            offer:{

                type:
                    offer.type,

                sdp:
                    offer.sdp

            },

            status:
                "ringing",

            createdAt:
                serverTimestamp()

        }

    );


    // --------------------------------------------------------
    // الاستماع للـ Answer
    // --------------------------------------------------------

    unsubscribeCall =
        onSnapshot(

            callRef,

            async snapshot => {

                if(
                    !snapshot.exists()
                ){

                    return;

                }


                const data =
                    snapshot.data();


                if(
                    data.status ===
                    "ended"
                ){

                    finishCall(
                        false
                    );

                    return;

                }


                if(
                    data.answer &&
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


                        await flushPendingCandidates();


                        setStatus(
                            "جارٍ الاتصال..."
                        );

                    }

                    catch(error){

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


    setStatus(
        "بانتظار الرد..."
    );

}


// ============================================================
// الرد على المكالمة
// ============================================================

async function answerIncomingCall(){

    if(
        !incomingCallId
    ){

        return;

    }


    callId =
        incomingCallId;


    const callRef =
        doc(

            db,

            "videoCalls",

            callId

        );


    const callSnap =
        await getDoc(
            callRef
        );


    if(
        !callSnap.exists()
    ){

        throw new Error(
            "المكالمة غير موجودة أو انتهت"
        );

    }


    const data =
        callSnap.data();


    if(
        data.status ===
        "ended"
    ){

        throw new Error(
            "المكالمة انتهت"
        );

    }


    cachedCallerId =
        data.callerId;


    // --------------------------------------------------------
    // بيانات المتصل
    // --------------------------------------------------------

    if(
        data.callerId
    ){

        const callerSnap =
            await getDoc(

                doc(
                    db,
                    "users",
                    data.callerId
                )

            );


        if(
            callerSnap.exists()
        ){

            const caller =
                callerSnap.data();


            friendUser = {

                uid:
                    data.callerId,

                name:
                    caller.name ||
                    data.callerName ||
                    "مستخدم Mecd",

                photo:
                    caller.photo ||
                    data.callerPhoto ||
                    ""

            };

        }

        else{

            friendUser = {

                uid:
                    data.callerId,

                name:
                    data.callerName ||
                    "مستخدم Mecd",

                photo:
                    data.callerPhoto ||
                    ""

            };

        }

    }


    if(friendUser){

        remoteName.textContent =
            friendUser.name;

        topName.textContent =
            friendUser.name;


        if(
            friendUser.photo
        ){

            remoteAvatar.innerHTML =

                '<img src="' +
                escapeHtml(
                    friendUser.photo
                ) +
                '" alt="صورة الحساب">';

        }

    }


    setStatus(
        "جارٍ الرد..."
    );


    await getLocalMedia();


    createPeerConnection();

    addLocalTracks();


    // --------------------------------------------------------
    // استقبال ICE من المتصل
    // --------------------------------------------------------

    listenCandidates(
        "callerCandidates"
    );


    // --------------------------------------------------------
    // Offer
    // --------------------------------------------------------

    if(
        !data.offer
    ){

        throw new Error(
            "بيانات المكالمة ناقصة"
        );

    }


    await peerConnection
        .setRemoteDescription(

            new RTCSessionDescription(
                data.offer
            )

        );


    await flushPendingCandidates();


    // --------------------------------------------------------
    // Answer
    // --------------------------------------------------------

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
                "connected"

        }

    );


    // --------------------------------------------------------
    // مراقبة إنهاء المكالمة
    // --------------------------------------------------------

    unsubscribeCall =
        onSnapshot(

            callRef,

            snapshot => {

                if(
                    !snapshot.exists()
                ){

                    finishCall(
                        false
                    );

                    return;

                }


                const call =
                    snapshot.data();


                if(
                    call.status ===
                    "ended"
                ){

                    finishCall(
                        false
                    );

                }

            }

        );


    setStatus(
        "متصل"
    );

}


// ============================================================
// إنهاء المكالمة
// ============================================================

async function endCall(){

    if(ended){

        return;

    }


    ended =
        true;


    try{

        if(
            callId
        ){

            await updateDoc(

                doc(
                    db,
                    "videoCalls",
                    callId
                ),

                {

                    status:
                        "ended",

                    endedAt:
                        serverTimestamp()

                }

            );

        }

    }

    catch(error){

        console.error(
            "End call error:",
            error
        );

    }


    cleanup();


    window.history.back();

}


// ============================================================
// إنهاء من الطرف الآخر
// ============================================================

function finishCall(
    goBack = true
){

    if(ended){

        return;

    }


    ended =
        true;


    setStatus(
        "انتهت المكالمة"
    );


    cleanup();


    if(goBack){

        setTimeout(

            () => {

                window.history.back();

            },

            700

        );

    }

}


// ============================================================
// تنظيف
// ============================================================

function cleanup(){

    if(
        unsubscribeCall
    ){

        unsubscribeCall();

        unsubscribeCall =
            null;

    }


    if(
        unsubscribeCandidates
    ){

        unsubscribeCandidates();

        unsubscribeCandidates =
            null;

    }


    if(
        peerConnection
    ){

        peerConnection
            .ontrack =
            null;

        peerConnection
            .onicecandidate =
            null;

        peerConnection
            .close();

        peerConnection =
            null;

    }


    if(localStream){

        localStream
            .getTracks()
            .forEach(

                track =>
                    track.stop()

            );

        localStream =
            null;

    }


    remoteVideo.srcObject =
        null;

    localVideo.srcObject =
        null;

}


// ============================================================
// 🎤 كتم المايك
// ============================================================

muteButton.addEventListener(

    "click",

    () => {

        if(!localStream){

            return;

        }


        const audioTracks =
            localStream
                .getAudioTracks();


        if(
            audioTracks.length ===
            0
        ){

            return;

        }


        microphoneEnabled =
            !microphoneEnabled;


        audioTracks.forEach(

            track => {

                track.enabled =
                    microphoneEnabled;

            }

        );


        muteButton.textContent =
            microphoneEnabled
            ?
            "🎤"
            :
            "🔇";


        muteButton.classList.toggle(
            "off",
            !microphoneEnabled
        );

    }

);


// ============================================================
// 📹 تشغيل / إيقاف الكاميرا
// ============================================================

cameraButton.addEventListener(

    "click",

    () => {

        if(!localStream){

            return;

        }


        const videoTracks =
            localStream
                .getVideoTracks();


        if(
            videoTracks.length ===
            0
        ){

            return;

        }


        cameraEnabled =
            !cameraEnabled;


        videoTracks.forEach(

            track => {

                track.enabled =
                    cameraEnabled;

            }

        );


        cameraButton.textContent =
            cameraEnabled
            ?
            "📹"
            :
            "🚫";


        cameraButton.classList.toggle(
            "off",
            !cameraEnabled
        );

    }

);


// ============================================================
// ☎ إنهاء
// ============================================================

endButton.addEventListener(

    "click",

    endCall

);


// ============================================================
// رجوع
// ============================================================

backButton.addEventListener(

    "click",

    endCall

);


// ============================================================
// إغلاق الصفحة
// ============================================================

window.addEventListener(

    "pagehide",

    () => {

        if(
            !ended &&
            callId
        ){

            try{

                updateDoc(

                    doc(
                        db,
                        "videoCalls",
                        callId
                    ),

                    {

                        status:
                            "ended",

                        endedAt:
                            serverTimestamp()

                    }

                );

            }

            catch(error){

                console.error(
                    error
                );

            }

        }


        cleanup();

    }

);


// ============================================================
// التشغيل
// ============================================================

async function init(){

    try{

        if(
            !friendId &&
            !incomingCallId
        ){

            throw new Error(
                "لا يوجد صديق أو مكالمة في الرابط"
            );

        }


        onAuthStateChanged(

            auth,

            async user => {

                if(!user){

                    showError(
                        "يجب تسجيل الدخول أولاً"
                    );

                    return;

                }


                currentUser =
                    user;


                try{

                    if(
                        incomingCallId
                    ){

                        await answerIncomingCall();

                    }

                    else{

                        await loadFriend();

                        await startOutgoingCall();

                    }


                    loading.classList.add(
                        "hidden"
                    );

                }

                catch(error){

                    console.error(
                        error
                    );

                    showError(
                        error?.message ||
                        "تعذر تشغيل مكالمة الفيديو"
                    );

                }

            }

        );

    }

    catch(error){

        showError(
            error?.message ||
            "حدث خطأ"
        );

    }

}


init();
