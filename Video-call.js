// ============================================================
// Video-call.js
// Mecd Chat - Video Call
// ============================================================

import {
    initializeApp,
    getApps
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
    updateDoc,
    deleteDoc,
    onSnapshot,
    collection,
    addDoc,
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
    ?
    getApps()[0]
    :
    initializeApp(firebaseConfig);


const auth =
    getAuth(firebaseApp);


const db =
    getFirestore(firebaseApp);


// ============================================================
// WebRTC
// ============================================================

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


// ============================================================
// حالة المكالمة
// ============================================================

let currentUser = null;

let currentCall = null;

let peerConnection = null;

let localStream = null;

let remoteStream = null;

let unsubscribeCall = null;

let unsubscribeOffer = null;

let unsubscribeAnswer = null;

let unsubscribeCallerCandidates = null;

let unsubscribeCalleeCandidates = null;

let callStartedAt = null;

let cameraFacingMode = "user";


// ============================================================
// عناصر الصفحة
// ============================================================

const remoteVideo =
    document.getElementById(
        "remoteVideo"
    );

const localVideo =
    document.getElementById(
        "localVideo"
    );

const waiting =
    document.getElementById(
        "waiting"
    );

const waitingName =
    document.getElementById(
        "waitingName"
    );

const waitingStatus =
    document.getElementById(
        "waitingStatus"
    );

const callStatus =
    document.getElementById(
        "callStatus"
    );

const micButton =
    document.getElementById(
        "micButton"
    );

const cameraButton =
    document.getElementById(
        "cameraButton"
    );

const switchCameraButton =
    document.getElementById(
        "switchCameraButton"
    );

const endButton =
    document.getElementById(
        "endButton"
    );

const errorBox =
    document.getElementById(
        "errorBox"
    );

const errorText =
    document.getElementById(
        "errorText"
    );


// ============================================================
// أدوات
// ============================================================

function setStatus(text){

    if(callStatus){

        callStatus.textContent =
            text;

    }

    if(waitingStatus){

        waitingStatus.textContent =
            text;

    }

}


function showWaiting(show){

    if(waiting){

        waiting.style.display =
            show
            ?
            "flex"
            :
            "none";

    }

}


function showError(error){

    console.error(
        "Video Call Error:",
        error
    );

    if(errorText){

        errorText.textContent =
            error?.message ||
            "حدث خطأ أثناء تشغيل المكالمة.";

    }

    if(errorBox){

        errorBox.style.display =
            "flex";

    }

}


function closeError(){

    if(errorBox){

        errorBox.style.display =
            "none";

    }

}


// ============================================================
// الحصول على بيانات المستخدم
// ============================================================

async function getCurrentUser(){

    if(auth.currentUser){

        currentUser =
            auth.currentUser;

        return currentUser;

    }

    return new Promise(
        (resolve,reject)=>{

            const unsubscribe =
                onAuthStateChanged(
                    auth,
                    user=>{

                        unsubscribe();

                        if(!user){

                            reject(
                                new Error(
                                    "يجب تسجيل الدخول أولاً."
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
// إنشاء PeerConnection
// ============================================================

function createPeerConnection(
    callId,
    role
){

    peerConnection =
        new RTCPeerConnection(
            rtcConfig
        );


    remoteStream =
        new MediaStream();


    if(remoteVideo){

        remoteVideo.srcObject =
            remoteStream;

    }


    if(localStream){

        localStream
        .getTracks()
        .forEach(
            track=>{

                peerConnection.addTrack(
                    track,
                    localStream
                );

            }
        );

    }


    peerConnection.ontrack =
        event=>{

            event.streams[0]
            ?.getTracks()
            .forEach(
                track=>{

                    remoteStream.addTrack(
                        track
                    );

                }
            );

            if(remoteVideo){

                remoteVideo.play()
                .catch(
                    ()=>{}
                );

            }

            showWaiting(false);

            setStatus(
                "● متصل"
            );

        };


    peerConnection.onconnectionstatechange =
        ()=>{

            if(!peerConnection){
                return;
            }

            const state =
                peerConnection
                .connectionState;


            console.log(
                "Video connection:",
                state
            );


            if(
                state ===
                "connected"
            ){

                showWaiting(false);

                setStatus(
                    "● متصل"
                );

            }


            if(
                state ===
                "connecting"
            ){

                setStatus(
                    "جاري الاتصال..."
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


    peerConnection.onicecandidate =
        async event=>{

            if(!event.candidate){
                return;
            }


            try{

                if(role === "caller"){

                    await addDoc(

                        collection(
                            db,
                            "videoCalls",
                            callId,
                            "callerCandidates"
                        ),

                        event.candidate.toJSON()

                    );

                }else{

                    await addDoc(

                        collection(
                            db,
                            "videoCalls",
                            callId,
                            "calleeCandidates"
                        ),

                        event.candidate.toJSON()

                    );

                }

            }catch(error){

                console.error(
                    "ICE candidate error:",
                    error
                );

            }

        };


    return peerConnection;

}


// ============================================================
// تشغيل الكاميرا والميكروفون
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
            "المتصفح لا يدعم الكاميرا أو الميكروفون."
        );

    }


    localStream =
        await navigator
        .mediaDevices
        .getUserMedia({

            video:{
                facingMode:
                    cameraFacingMode
            },

            audio:true

        });


    if(localVideo){

        localVideo.srcObject =
            localStream;

        localVideo.muted =
            true;

        localVideo.playsInline =
            true;

        localVideo.play()
        .catch(
            ()=>{}
        );

    }


    return localStream;

}


// ============================================================
// تشغيل مكالمة الفيديو
// ============================================================

export async function startVideoCall({

    friendId,

    friendName = "مستخدم Mecd",

    friendPhoto = "",

    chatId = ""

}){

    await getCurrentUser();


    if(!friendId){

        throw new Error(
            "لم يتم تحديد الصديق."
        );

    }


    if(
        friendId ===
        currentUser.uid
    ){

        throw new Error(
            "لا يمكنك الاتصال بنفسك."
        );

    }


    currentCall = {

        friendId:
            friendId,

        friendName:
            friendName,

        friendPhoto:
            friendPhoto,

        chatId:
            chatId

    };


    if(waitingName){

        waitingName.textContent =
            friendName;

    }


    if(
        document.getElementById(
            "friendName"
        )
    ){

        document.getElementById(
            "friendName"
        ).textContent =
            friendName;

    }


    closeError();

    showWaiting(true);

    setStatus(
        "جاري تشغيل الكاميرا..."
    );


    try{

        await getLocalMedia();


        setStatus(
            "جاري إنشاء المكالمة..."
        );


        const callRef =
            doc(
                collection(
                    db,
                    "videoCalls"
                )
            );


        const callId =
            callRef.id;


        currentCall.id =
            callId;


        peerConnection =
            createPeerConnection(
                callId,
                "caller"
            );


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
                    friendId,

                callerName:
                    currentUser.displayName ||
                    "مستخدم Mecd",

                callerPhoto:
                    currentUser.photoURL ||
                    "",

                callType:
                    "video",

                status:
                    "ringing",

                createdAt:
                    serverTimestamp(),

                offer:{
                    type:
                        offer.type,

                    sdp:
                        offer.sdp
                }

            }

        );


        callStartedAt =
            Date.now();


        setStatus(
            "جاري الاتصال..."
        );


        listenForAnswer(
            callRef
        );


        listenForCalleeCandidates(
            callRef
        );


        listenForCallStatus(
            callRef
        );


        await waitForAnswer(
            callRef
        );


    }catch(error){

        await cleanup();

        throw error;

    }

}


// ============================================================
// انتظار Answer
// ============================================================

function listenForAnswer(
    callRef
){

    unsubscribeAnswer =
        onSnapshot(

            callRef,

            async snap=>{

                if(!snap.exists()){
                    return;
                }


                const data =
                    snap.data();


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

                        showWaiting(false);

                        setStatus(
                            "● متصل"
                        );

                    }catch(error){

                        console.error(
                            "Answer error:",
                            error
                        );

                    }

                }


                if(
                    data.status ===
                    "rejected"
                ){

                    setStatus(
                        "تم رفض المكالمة"
                    );

                    setTimeout(
                        cleanup,
                        1000
                    );

                }


                if(
                    data.status ===
                    "ended"
                ){

                    setStatus(
                        "انتهت المكالمة"
                    );

                    setTimeout(
                        cleanup,
                        500
                    );

                }

            }

        );

}


// ============================================================
// انتظار ICE من الطرف الآخر
// ============================================================

function listenForCalleeCandidates(
    callRef
){

    unsubscribeCalleeCandidates =
        onSnapshot(

            collection(
                db,
                "videoCalls",
                callRef.id,
                "calleeCandidates"
            ),

            snapshot=>{

                snapshot.docChanges()
                .forEach(
                    async change=>{

                        if(
                            change.type !==
                            "added"
                        ){
                            return;
                        }


                        if(!peerConnection){
                            return;
                        }


                        try{

                            await peerConnection
                            .addIceCandidate(

                                new RTCIceCandidate(
                                    change.doc.data()
                                )

                            );

                        }catch(error){

                            console.error(
                                "Remote ICE error:",
                                error
                            );

                        }

                    }
                );

            }

        );

}


// ============================================================
// مراقبة حالة المكالمة
// ============================================================

function listenForCallStatus(
    callRef
){

    unsubscribeCall =
        onSnapshot(

            callRef,

            snap=>{

                if(!snap.exists()){
                    return;
                }


                const data =
                    snap.data();


                if(
                    data.status ===
                    "ended"
                ){

                    setStatus(
                        "انتهت المكالمة"
                    );

                    cleanup();

                }

            }

        );

}


// ============================================================
// انتظار بسيط حتى يتم إنشاء Answer
// ============================================================

function waitForAnswer(
    callRef
){

    return new Promise(
        resolve=>{

            let done =
                false;


            const unsubscribe =
                onSnapshot(

                    callRef,

                    snap=>{

                        const data =
                            snap.data();


                        if(
                            data?.answer &&
                            !done
                        ){

                            done =
                                true;

                            unsubscribe();

                            resolve();

                        }

                    }

                );

        }
    );

}


// ============================================================
// استقبال مكالمات الفيديو
// ============================================================

export async function listenIncomingVideoCalls(){

    await getCurrentUser();


    const callsRef =
        collection(
            db,
            "videoCalls"
        );


    return onSnapshot(

        callsRef,

        async snapshot=>{

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


                const data =
                    change.doc.data();


                if(
                    data.calleeId !==
                    currentUser.uid
                ){

                    continue;

                }


                if(
                    data.callType !==
                    "video"
                ){

                    continue;

                }


                if(
                    data.status !==
                    "ringing"
                ){

                    continue;

                }


                console.log(
                    "📹 Incoming video call:",
                    change.doc.id
                );


                // لا نفتح المكالمة تلقائياً
                // إذا كانت صفحة الفيديو غير موجودة.
                //
                // يمكنك لاحقاً إضافة نافذة
                // قبول / رفض هنا.

            }

        }

    );

}


// ============================================================
// إنهاء المكالمة
// ============================================================

async function endCall(){

    try{

        if(
            currentCall?.id &&
            currentUser
        ){

            await updateDoc(

                doc(
                    db,
                    "videoCalls",
                    currentCall.id
                ),

                {

                    status:
                        "ended",

                    endedAt:
                        serverTimestamp(),

                    endedBy:
                        currentUser.uid

                }

            );

        }

    }catch(error){

        console.error(
            "End call Firestore error:",
            error
        );

    }


    await cleanup();

}


// ============================================================
// تنظيف المكالمة
// ============================================================

async function cleanup(){

    if(unsubscribeCall){

        unsubscribeCall();

        unsubscribeCall =
            null;

    }


    if(unsubscribeAnswer){

        unsubscribeAnswer();

        unsubscribeAnswer =
            null;

    }


    if(unsubscribeCallerCandidates){

        unsubscribeCallerCandidates();

        unsubscribeCallerCandidates =
            null;

    }


    if(unsubscribeCalleeCandidates){

        unsubscribeCalleeCandidates();

        unsubscribeCalleeCandidates =
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
            track=>{
                track.stop();
            }
        );

        localStream =
            null;

    }


    if(remoteStream){

        remoteStream
        .getTracks()
        .forEach(
            track=>{
                track.stop();
            }
        );

        remoteStream =
            null;

    }


    if(localVideo){

        localVideo.srcObject =
            null;

    }


    if(remoteVideo){

        remoteVideo.srcObject =
            null;

    }


    currentCall =
        null;


    showWaiting(true);

    setStatus(
        "انتهت المكالمة"
    );

}


// ============================================================
// الميكروفون
// ============================================================

function toggleMicrophone(){

    if(!localStream){
        return;
    }


    const audioTracks =
        localStream
        .getAudioTracks();


    if(!audioTracks.length){
        return;
    }


    const enabled =
        audioTracks[0].enabled;


    audioTracks
    .forEach(
        track=>{
            track.enabled =
                !enabled;
        }
    );


    if(micButton){

        micButton.textContent =
            enabled
            ?
            "🔇"
            :
            "🎤";

        micButton.classList.toggle(
            "off",
            enabled
        );

    }

}


// ============================================================
// الكاميرا
// ============================================================

function toggleCamera(){

    if(!localStream){
        return;
    }


    const videoTracks =
        localStream
        .getVideoTracks();


    if(!videoTracks.length){
        return;
    }


    const enabled =
        videoTracks[0].enabled;


    videoTracks
    .forEach(
        track=>{
            track.enabled =
                !enabled;
        }
    );


    if(cameraButton){

        cameraButton.textContent =
            enabled
            ?
            "🚫"
            :
            "📹";

        cameraButton.classList.toggle(
            "off",
            enabled
        );

    }

}


// ============================================================
// تبديل الكاميرا الأمامية/الخلفية
// ============================================================

async function switchCamera(){

    if(!navigator.mediaDevices){
        return;
    }


    cameraFacingMode =
        cameraFacingMode ===
        "user"
        ?
        "environment"
        :
        "user";


    try{

        const newStream =
            await navigator
            .mediaDevices
            .getUserMedia({

                video:{
                    facingMode:
                        cameraFacingMode
                },

                audio:false

            });


        const newTrack =
            newStream
            .getVideoTracks()[0];


        if(!newTrack){
            return;
        }


        if(localStream){

            const oldTrack =
                localStream
                .getVideoTracks()[0];


            if(oldTrack){

                localStream.removeTrack(
                    oldTrack
                );

                oldTrack.stop();

            }


            localStream.addTrack(
                newTrack
            );

        }


        if(localVideo){

            localVideo.srcObject =
                localStream;

        }


        if(peerConnection){

            const sender =
                peerConnection
                .getSenders()
                .find(
                    s =>
                        s.track &&
                        s.track.kind ===
                        "video"
                );


            if(sender){

                await sender.replaceTrack(
                    newTrack
                );

            }

        }

    }catch(error){

        console.error(
            "Switch camera error:",
            error
        );

    }

}


// ============================================================
// أزرار التحكم
// ============================================================

if(micButton){

    micButton.addEventListener(
        "click",
        toggleMicrophone
    );

}


if(cameraButton){

    cameraButton.addEventListener(
        "click",
        toggleCamera
    );

}


if(switchCameraButton){

    switchCameraButton.addEventListener(
        "click",
        switchCamera
    );

}


if(endButton){

    endButton.addEventListener(
        "click",
        endCall
    );

}


// ============================================================
// منع خروج الصفحة بدون تنظيف
// ============================================================

window.addEventListener(
    "pagehide",
    ()=>{
        cleanup();
    }
);


// ============================================================
// جاهز
// ============================================================

console.log(
    "📹 Mecd Video Call JS loaded"
);
