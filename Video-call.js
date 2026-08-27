// ============================================================
// Mecd Chat - Video Call
// Video-call.js
// ============================================================

import {
    initializeApp
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged
}
from
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
}
from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


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
// صفحة الفيديو
// ============================================================

const isVideoPage =
    !!document.getElementById(
        "remoteVideo"
    );


// ============================================================
// المتغيرات
// ============================================================

let currentUser = null;

let friendUser = null;

let callId = null;

let peerConnection = null;

let localStream = null;

let unsubscribeCall = null;

let unsubscribeCandidates = null;

let ended = false;

let microphoneEnabled = true;

let cameraEnabled = true;

let cachedCallerId = null;


// ============================================================
// ICE
// ============================================================

const pendingCandidates = [];

const addedCandidateIds =
    new Set();


// ============================================================
// WebRTC
// ============================================================

const rtcConfiguration = {

    iceServers:[

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
// العناصر
// ============================================================

const $ =
    id =>
        document.getElementById(id);


let videoApp;
let loading;
let remoteVideo;
let localVideo;
let remotePlaceholder;
let remoteAvatar;
let remoteName;
let callStatus;
let topName;
let topStatus;
let muteButton;
let cameraButton;
let endButton;
let backButton;
let errorBox;


if(isVideoPage){

    videoApp =
        $("videoApp");

    loading =
        $("loading");

    remoteVideo =
        $("remoteVideo");

    localVideo =
        $("localVideo");

    remotePlaceholder =
        $("remotePlaceholder");

    remoteAvatar =
        $("remoteAvatar");

    remoteName =
        $("remoteName");

    callStatus =
        $("callStatus");

    topName =
        $("topName");

    topStatus =
        $("topStatus");

    muteButton =
        $("muteButton");

    cameraButton =
        $("cameraButton");

    endButton =
        $("endButton");

    backButton =
        $("backButton");

    errorBox =
        $("errorBox");

}


// ============================================================
// بيانات الرابط
// ============================================================

const params =
    new URLSearchParams(
        window.location.search
    );

const friendId =
    params.get("friend");

const incomingCallId =
    params.get("call");


// ============================================================
// تكبير / تصغير الفيديوهات
// ============================================================

function setupVideoSwap(){

    if(
        !isVideoPage ||
        !videoApp ||
        !localVideo ||
        !remoteVideo
    ){

        return;

    }


    localVideo.addEventListener(
        "click",
        toggleVideoSize
    );


    remoteVideo.addEventListener(
        "click",
        () => {

            if(
                videoApp.classList.contains(
                    "local-big"
                )
            ){

                toggleVideoSize();

            }

        }
    );

}


function toggleVideoSize(){

    if(!videoApp){

        return;

    }

    videoApp.classList.toggle(
        "local-big"
    );

}


// ============================================================
// بدء المكالمة من chat.html
// ============================================================

export async function startVideoCall(
    options
){

    if(!options){

        throw new Error(
            "بيانات المكالمة غير موجودة"
        );

    }

    if(!options.friendId){

        throw new Error(
            "معرف الصديق غير موجود"
        );

    }

    const url =
        new URL(
            "./Video-call.html",
            window.location.href
        );

    url.searchParams.set(
        "friend",
        options.friendId
    );

    if(options.chatId){

        url.searchParams.set(
            "chat",
            options.chatId
        );

    }

    window.location.href =
        url.toString();

}


// ============================================================
// حماية HTML
// ============================================================

function escapeHtml(value){

    return String(value)

        .replace(
            /[&<>'"]/g,

            c => ({

                "&":"&amp;",
                "<":"&lt;",
                ">":"&gt;",
                "'":"&#39;",
                '"':"&quot;"

            }[c])

        );

}


// ============================================================
// الحالة
// ============================================================

function setStatus(text){

    if(!isVideoPage){

        return;

    }

    if(callStatus){

        callStatus.textContent =
            text;

    }

    if(topStatus){

        topStatus.textContent =
            text;

    }

}


// ============================================================
// الخطأ
// ============================================================

function showError(message){

    console.error(
        "Video call:",
        message
    );

    if(!isVideoPage){

        return;

    }

    if(loading){

        loading.classList.add(
            "hidden"
        );

    }

    if(errorBox){

        errorBox.textContent =
            message;

        errorBox.classList.remove(
            "hidden"
        );

    }

    setStatus(
        "تعذر الاتصال"
    );

}


// ============================================================
// بيانات الصديق
// ============================================================

async function loadFriend(){

    if(!friendId){

        throw new Error(
            "لا يوجد صديق في الرابط"
        );

    }

    const snap =
        await getDoc(

            doc(
                db,
                "users",
                friendId
            )

        );

    if(!snap.exists()){

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


    if(remoteName){

        remoteName.textContent =
            friendUser.name;

    }


    if(topName){

        topName.textContent =
            friendUser.name;

    }


    if(
        friendUser.photo &&
        remoteAvatar
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
// الكاميرا والمايك
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


    if(localVideo){

        localVideo.srcObject =
            localStream;

    }


    return localStream;

}


// ============================================================
// Caller ID
// ============================================================

function getCallerId(){

    return cachedCallerId;

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
            rtcConfiguration
        );


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


    peerConnection.ontrack =
        event => {

            if(
                event.streams &&
                event.streams[0]
            ){

                if(remoteVideo){

                    remoteVideo.srcObject =
                        event.streams[0];

                }


                if(remotePlaceholder){

                    remotePlaceholder.classList.add(
                        "hidden"
                    );

                }


                setStatus(
                    "متصل"
                );

            }

        };


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


            if(state === "connected"){

                setStatus(
                    "متصل"
                );

            }

            else if(state === "connecting"){

                setStatus(
                    "جارٍ الاتصال..."
                );

            }

            else if(state === "disconnected"){

                setStatus(
                    "انقطع الاتصال"
                );

            }

            else if(state === "failed"){

                setStatus(
                    "فشل الاتصال"
                );

            }

        };


    return peerConnection;

}


// ============================================================
// إضافة Tracks
// ============================================================

function addLocalTracks(){

    if(
        !localStream ||
        !peerConnection
    ){

        return;

    }


    const senders =
        peerConnection.getSenders();


    localStream
        .getTracks()
        .forEach(

            track => {

                const exists =
                    senders.some(

                        sender =>

                            sender.track &&
                            sender.track.kind ===
                            track.kind

                    );


                if(!exists){

                    peerConnection.addTrack(
                        track,
                        localStream
                    );

                }

            }

        );

}


// ============================================================
// ICE المؤجل
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

    if(unsubscribeCandidates){

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
                        addedCandidateIds.has(
                            change.doc.id
                        )
                    ){

                        continue;

                    }


                    addedCandidateIds.add(
                        change.doc.id
                    );


                    const candidate =
                        new RTCIceCandidate(
                            change.doc.data()
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
                    "ICE listener:",
                    error
                );

            }

        );

}


// ============================================================
// المكالمة الصادرة
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


    listenCandidates(
        "calleeCandidates"
    );


    const offer =
        await peerConnection
            .createOffer({

                offerToReceiveAudio:
                    true,

                offerToReceiveVideo:
                    true

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

                    finishCall(false);

                    return;

                }


                if(
                    data.answer &&
                    peerConnection &&
                    !peerConnection.currentRemoteDescription
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
                            "متصل"
                        );

                    }

                    catch(error){

                        console.error(
                            "Answer error:",
                            error
                        );

                    }

                }

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


    if(!callSnap.exists()){

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


    if(data.callerId){

        const callerSnap =
            await getDoc(

                doc(
                    db,
                    "users",
                    data.callerId
                )

            );


        if(callerSnap.exists()){

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

        if(remoteName){

            remoteName.textContent =
                friendUser.name;

        }


        if(topName){

            topName.textContent =
                friendUser.name;

        }


        if(
            friendUser.photo &&
            remoteAvatar
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


    listenCandidates(
        "callerCandidates"
    );


    if(!data.offer){

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


    unsubscribeCall =
        onSnapshot(

            callRef,

            snapshot => {

                if(
                    !snapshot.exists()
                ){

                    finishCall(false);

                    return;

                }


                const call =
                    snapshot.data();


                if(
                    call.status ===
                    "ended"
                ){

                    finishCall(false);

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

        if(callId){

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
// الطرف الآخر أنهى
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


    if(peerConnection){

        peerConnection.ontrack =
            null;

        peerConnection.onicecandidate =
            null;

        peerConnection.close();

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


    if(remoteVideo){

        remoteVideo.srcObject =
            null;

    }


    if(localVideo){

        localVideo.srcObject =
            null;

    }

}


// ============================================================
// أزرار التحكم
// ============================================================

function setupVideoControls(){

    if(!isVideoPage){

        return;

    }


    if(muteButton){

        muteButton.addEventListener(

            "click",

            () => {

                if(!localStream){

                    return;

                }


                const tracks =
                    localStream
                        .getAudioTracks();


                if(!tracks.length){

                    return;

                }


                microphoneEnabled =
                    !microphoneEnabled;


                tracks.forEach(

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

    }


    if(cameraButton){

        cameraButton.addEventListener(

            "click",

            () => {

                if(!localStream){

                    return;

                }


                const tracks =
                    localStream
                        .getVideoTracks();


                if(!tracks.length){

                    return;

                }


                cameraEnabled =
                    !cameraEnabled;


                tracks.forEach(

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

    }


    if(endButton){

        endButton.addEventListener(
            "click",
            endCall
        );

    }


    if(backButton){

        backButton.addEventListener(
            "click",
            endCall
        );

    }


    window.addEventListener(

        "pagehide",

        () => {

            if(
                !ended &&
                callId
            ){

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

                ).catch(
                    console.error
                );

            }


            cleanup();

        }

    );

}


// ============================================================
// تشغيل الصفحة
// ============================================================

function initVideoPage(){

    if(!isVideoPage){

        return;

    }


    setupVideoSwap();

    setupVideoControls();


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

                if(incomingCallId){

                    await answerIncomingCall();

                }

                else{

                    await loadFriend();

                    await startOutgoingCall();

                }


                if(loading){

                    loading.classList.add(
                        "hidden"
                    );

                }

            }

            catch(error){

                console.error(
                    "Video init error:",
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


// ============================================================
// تشغيل
// ============================================================

initVideoPage();
