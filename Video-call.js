// ============================================================
// Mecd Chat
// Video-call.js
// ============================================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
    initializeApp(firebaseConfig);

const auth =
    getAuth(firebaseApp);

const db =
    getFirestore(firebaseApp);


// ============================================================
// العناصر
// ============================================================

const $ =
    id => document.getElementById(id);

const remoteVideo =
    $("remoteVideo");

const localVideo =
    $("localVideo");

const remotePlaceholder =
    $("remotePlaceholder");

const remoteAvatar =
    $("remoteAvatar");

const remotePlaceholderName =
    $("remotePlaceholderName");

const callName =
    $("callName");

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

const loading =
    $("loading");

const errorBox =
    $("errorBox");

const errorMessage =
    $("errorMessage");


// ============================================================
// الحالة
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

let callerId = null;

const pendingCandidates = [];
const addedCandidates = new Set();


// ============================================================
// WebRTC
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
// الحالة
// ============================================================

function setStatus(text){

    if(callStatus)
        callStatus.textContent = text;

    if(topStatus)
        topStatus.textContent = text;

}


// ============================================================
// HTML
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
// بيانات الصديق
// ============================================================

function setFriendUI(){

    if(!friendUser)
        return;

    const name =
        friendUser.name ||
        "مستخدم Mecd";

    topName.textContent = name;
    callName.textContent = name;
    remotePlaceholderName.textContent = name;

    if(friendUser.photo){

        remoteAvatar.innerHTML =
            '<img src="' +
            escapeHtml(friendUser.photo) +
            '" alt="صورة الحساب">';

    }

}


// ============================================================
// تحميل الصديق
// ============================================================

async function loadFriend(id){

    const snap =
        await getDoc(
            doc(
                db,
                "users",
                id
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

        uid:id,

        name:
            data.name ||
            "مستخدم Mecd",

        photo:
            data.photo ||
            ""

    };

    setFriendUI();

}


// ============================================================
// الوسائط
// ============================================================

async function getLocalMedia(){

    if(localStream)
        return localStream;

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

        console.error(error);

        throw new Error(
            "لم يتم السماح باستخدام الكاميرا والمايك"
        );

    }

    localVideo.srcObject =
        localStream;

    return localStream;

}


// ============================================================
// PeerConnection
// ============================================================

function createPeerConnection(){

    if(peerConnection)
        return peerConnection;

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
            )
                return;

            const collectionName =
                currentUser.uid === callerId
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
                    "ICE:",
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


    peerConnection.onconnectionstatechange =
        () => {

            if(!peerConnection)
                return;

            const state =
                peerConnection.connectionState;

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
// Tracks
// ============================================================

function addLocalTracks(){

    if(
        !localStream ||
        !peerConnection
    )
        return;

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
// ICE
// ============================================================

async function flushCandidates(){

    if(
        !peerConnection ||
        !peerConnection.remoteDescription
    )
        return;

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
                "Candidate:",
                error
            );

        }

    }

}


function listenCandidates(
    collectionName
){

    if(unsubscribeCandidates)
        unsubscribeCandidates();

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
                    )
                        continue;

                    if(
                        addedCandidates.has(
                            change.doc.id
                        )
                    )
                        continue;

                    addedCandidates.add(
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

                            console.error(error);

                        }

                    }
                    else{

                        pendingCandidates.push(
                            candidate
                        );

                    }

                }

            }
        );

}


// ============================================================
// المكالمة الصادرة
// ============================================================

async function startOutgoing(){

    setStatus(
        "جارٍ تشغيل الكاميرا..."
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

    callerId =
        currentUser.uid;

    listenCandidates(
        "calleeCandidates"
    );

    const offer =
        await peerConnection
            .createOffer();

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
                type:offer.type,
                sdp:offer.sdp
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

            async snap => {

                if(!snap.exists())
                    return;

                const data =
                    snap.data();

                if(
                    data.status ===
                    "ended"
                ){

                    finishCall();

                    return;

                }

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

                    await flushCandidates();

                    setStatus(
                        "جارٍ الاتصال..."
                    );

                }

                if(
                    data.status ===
                    "connected"
                ){

                    setStatus(
                        "متصل"
                    );

                }

            }

        );

    setStatus(
        "بانتظار الرد..."
    );

}


// ============================================================
// المكالمة الواردة
// ============================================================

async function answerIncoming(){

    callId =
        new URLSearchParams(
            location.search
        ).get("call");

    const callRef =
        doc(
            db,
            "videoCalls",
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
        data.status ===
        "ended"
    ){

        throw new Error(
            "المكالمة انتهت"
        );

    }

    callerId =
        data.callerId;

    await loadFriend(
        data.callerId
    );

    await getLocalMedia();

    createPeerConnection();

    addLocalTracks();

    listenCandidates(
        "callerCandidates"
    );

    await peerConnection
        .setRemoteDescription(

            new RTCSessionDescription(
                data.offer
            )

        );

    await flushCandidates();

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
                type:answer.type,
                sdp:answer.sdp
            },

            status:
                "connected"

        }

    );

    unsubscribeCall =
        onSnapshot(
            callRef,
            snap => {

                if(!snap.exists())
                    return;

                if(
                    snap.data().status ===
                    "ended"
                ){

                    finishCall();

                }

            }
        );

    setStatus(
        "متصل"
    );

}


// ============================================================
// إنهاء
// ============================================================

async function endCall(){

    if(ended)
        return;

    ended = true;

    try{

        if(callId){

            await updateDoc(

                doc(
                    db,
                    "videoCalls",
                    callId
                ),

                {
                    status:"ended",
                    endedAt:
                        serverTimestamp()
                }

            );

        }

    }
    catch(error){

        console.error(error);

    }

    cleanup();

    history.back();

}


function finishCall(){

    if(ended)
        return;

    ended = true;

    setStatus(
        "انتهت المكالمة"
    );

    cleanup();

    setTimeout(
        () => history.back(),
        700
    );

}


function cleanup(){

    if(unsubscribeCall)
        unsubscribeCall();

    if(unsubscribeCandidates)
        unsubscribeCandidates();

    unsubscribeCall =
        null;

    unsubscribeCandidates =
        null;

    if(peerConnection){

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

}


// ============================================================
// الأزرار
// ============================================================

muteButton.addEventListener(
    "click",
    () => {

        if(!localStream)
            return;

        microphoneEnabled =
            !microphoneEnabled;

        localStream
            .getAudioTracks()
            .forEach(
                track =>
                    track.enabled =
                        microphoneEnabled
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


cameraButton.addEventListener(
    "click",
    () => {

        if(!localStream)
            return;

        cameraEnabled =
            !cameraEnabled;

        localStream
            .getVideoTracks()
            .forEach(
                track =>
                    track.enabled =
                        cameraEnabled
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


endButton.addEventListener(
    "click",
    endCall
);


backButton.addEventListener(
    "click",
    endCall
);


// ============================================================
// Init
// ============================================================

async function init(){

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

                const params =
                    new URLSearchParams(
                        location.search
                    );

                const incoming =
                    params.get("call");

                if(incoming){

                    await answerIncoming();

                }
                else{

                    const friendId =
                        params.get("friend");

                    if(!friendId){

                        throw new Error(
                            "لم يتم تحديد الصديق"
                        );

                    }

                    await loadFriend(
                        friendId
                    );

                    await startOutgoing();

                }

                loading.classList.add(
                    "hidden"
                );

            }
            catch(error){

                console.error(error);

                loading.classList.add(
                    "hidden"
                );

                errorMessage.textContent =
                    error.message ||
                    "تعذر تشغيل المكالمة";

                errorBox.classList.remove(
                    "hidden"
                );

            }

        }
    );

}


function showError(message){

    loading.classList.add(
        "hidden"
    );

    errorMessage.textContent =
        message;

    errorBox.classList.remove(
        "hidden"
    );

}


init();
