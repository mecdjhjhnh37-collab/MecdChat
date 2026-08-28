// ============================================================
// Mecd Chat - Voice Call
// call.js
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
    getDoc,
    setDoc,
    updateDoc,
    addDoc,
    collection,
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


const app =
    getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig);


const auth =
    getAuth(app);


const db =
    getFirestore(app);


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
// المتغيرات
// ============================================================

let currentUser = null;

let activeCall = null;

let peerConnection = null;

let localStream = null;

let unsubscribeIncoming = null;

let unsubscribeCall = null;

let unsubscribeRemoteCandidates = null;

let callCandidates = new Set();


// ============================================================
// Auth
// ============================================================

onAuthStateChanged(
    auth,
    user => {

        currentUser = user;

        if(user){

            startIncomingListener();

        }

    }
);


// ============================================================
// إنشاء اتصال WebRTC
// ============================================================

function createPeer(){

    if(peerConnection){

        return peerConnection;

    }


    peerConnection =
        new RTCPeerConnection(
            rtcConfig
        );


    peerConnection.onicecandidate =
        async event => {

            if(
                !event.candidate ||
                !activeCall
            ){

                return;

            }


            const type =
                currentUser.uid ===
                activeCall.callerId
                ?
                "callerCandidates"
                :
                "calleeCandidates";


            try{

                await addDoc(

                    collection(
                        db,
                        "videoCalls",
                        activeCall.callId,
                        type
                    ),

                    event.candidate.toJSON()

                );

            }catch(error){

                console.error(
                    "ICE:",
                    error
                );

            }

        };


    peerConnection.onconnectionstatechange =
        () => {

            if(!peerConnection){

                return;

            }


            console.log(
                "Voice:",
                peerConnection.connectionState
            );


            if(
                peerConnection.connectionState ===
                "connected"
            ){

                setCallStatus(
                    "متصل"
                );

            }


            if(
                peerConnection.connectionState ===
                "failed"
            ){

                setCallStatus(
                    "فشل الاتصال"
                );

            }

        };


    return peerConnection;

}


// ============================================================
// المايك
// ============================================================

async function getMicrophone(){

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
        await navigator
            .mediaDevices
            .getUserMedia({

                audio:true,

                video:false

            });


    return localStream;

}


// ============================================================
// إضافة المايك
// ============================================================

function addLocalAudio(){

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
// مراقبة ICE
// ============================================================

function listenCandidates(
    collectionName
){

    if(unsubscribeRemoteCandidates){

        unsubscribeRemoteCandidates();

    }


    const ref =
        collection(
            db,
            "videoCalls",
            activeCall.callId,
            collectionName
        );


    unsubscribeRemoteCandidates =
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
                        callCandidates.has(
                            change.doc.id
                        )
                    ){

                        continue;

                    }


                    callCandidates.add(
                        change.doc.id
                    );


                    try{

                        await peerConnection
                            .addIceCandidate(

                                new RTCIceCandidate(
                                    change.doc.data()
                                )

                            );

                    }catch(error){

                        console.error(
                            "ICE candidate:",
                            error
                        );

                    }

                }

            }

        );

}


// ============================================================
// بدء مكالمة
// ============================================================

export async function startCall({

    friendId,
    friendName,
    friendPhoto

}){

    if(!currentUser){

        throw new Error(
            "يجب تسجيل الدخول أولاً"
        );

    }


    if(activeCall){

        return;

    }


    // إنشاء واجهة المكالمة فورًا
    openCallPage({

        name:
            friendName ||
            "مستخدم Mecd",

        photo:
            friendPhoto ||
            "",

        outgoing:true

    });


    setCallStatus(
        "اتصال..."
    );


    await getMicrophone();


    createPeer();

    addLocalAudio();


    const callRef =
        doc(
            collection(
                db,
                "videoCalls"
            )
        );


    const callId =
        callRef.id;


    activeCall = {

        callId,
        callerId:
            currentUser.uid,

        calleeId:
            friendId,

        friendName:
            friendName ||
            "مستخدم Mecd",

        friendPhoto:
            friendPhoto ||
            ""

    };


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
                friendId,

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

            async snap => {

                if(!snap.exists()){

                    return;

                }


                const data =
                    snap.data();


                if(
                    data.status ===
                    "rejected"
                ){

                    setCallStatus(
                        "تم رفض المكالمة"
                    );

                    setTimeout(
                        cleanupCall,
                        1000
                    );

                    return;

                }


                if(
                    data.status ===
                    "ended"
                ){

                    setCallStatus(
                        "انتهت المكالمة"
                    );

                    setTimeout(
                        cleanupCall,
                        500
                    );

                    return;

                }


                if(
                    data.answer &&
                    !peerConnection.currentRemoteDescription
                ){

                    await peerConnection
                        .setRemoteDescription(

                            new RTCSessionDescription(
                                data.answer
                            )

                        );


                    setCallStatus(
                        "جارٍ الاتصال..."
                    );

                }


                if(
                    data.status ===
                    "connected"
                ){

                    setCallStatus(
                        "متصل"
                    );

                }

            }

        );

}


// ============================================================
// مراقبة المكالمات الواردة
// ============================================================

function startIncomingListener(){

    if(
        !currentUser ||
        unsubscribeIncoming
    ){

        return;

    }


    const callsRef =
        collection(
            db,
            "videoCalls"
        );


    const q =
        query(

            callsRef,

            where(
                "calleeId",
                "==",
                currentUser.uid
            ),

            where(
                "status",
                "==",
                "ringing"
            )

        );


    unsubscribeIncoming =
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


                            if(
                                activeCall
                            ){

                                return;

                            }


                            showIncomingCall(

                                change.doc.id,

                                data

                            );

                        }
                    );

            },

            error => {

                console.error(
                    "Incoming calls:",
                    error
                );

            }

        );

}


// ============================================================
// إظهار المكالمة الواردة
// ============================================================

function showIncomingCall(
    callId,
    data
){

    if(
        document.getElementById(
            "mecdIncomingCall"
        )
    ){

        return;

    }


    const box =
        document.createElement(
            "div"
        );

    box.id =
        "mecdIncomingCall";


    box.innerHTML = `

        <div class="mecd-incoming-card">

            <div class="mecd-incoming-avatar">
                ${
                    data.callerPhoto
                    ?
                    `<img src="${escapeHtml(data.callerPhoto)}">`
                    :
                    "👤"
                }
            </div>

            <div class="mecd-incoming-name">

                ${escapeHtml(
                    data.callerName ||
                    "مستخدم Mecd"
                )}

            </div>

            <div class="mecd-incoming-text">

                📞 مكالمة واردة

            </div>

            <div class="mecd-incoming-buttons">

                <button
                    id="mecdAcceptCall">

                    قبول

                </button>

                <button
                    id="mecdRejectCall">

                    رفض

                </button>

            </div>

        </div>

    `;


    addIncomingStyle();


    document.body.appendChild(
        box
    );


    document
        .getElementById(
            "mecdAcceptCall"
        )
        .onclick =
            () => {

                box.remove();

                answerCall(
                    callId,
                    data
                );

            };


    document
        .getElementById(
            "mecdRejectCall"
        )
        .onclick =
            async () => {

                box.remove();

                try{

                    await updateDoc(

                        doc(
                            db,
                            "videoCalls",
                            callId
                        ),

                        {
                            status:
                                "rejected"
                        }

                    );

                }catch(error){

                    console.error(
                        error
                    );

                }

            };

}


// ============================================================
// قبول المكالمة
// ============================================================

async function answerCall(
    callId,
    data
){

    try{

        activeCall = {

            callId,

            callerId:
                data.callerId,

            calleeId:
                currentUser.uid,

            friendName:
                data.callerName ||
                "مستخدم Mecd",

            friendPhoto:
                data.callerPhoto ||
                ""

        };


        openCallPage({

            name:
                activeCall.friendName,

            photo:
                activeCall.friendPhoto,

            outgoing:false

        });


        setCallStatus(
            "جارٍ الاتصال..."
        );


        await getMicrophone();


        createPeer();

        addLocalAudio();


        listenCandidates(
            "callerCandidates"
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

            doc(
                db,
                "videoCalls",
                callId
            ),

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


        listenCallStatus();


    }catch(error){

        console.error(
            "Answer error:",
            error
        );

        alert(
            "تعذر تشغيل المكالمة: " +
            error.message
        );

        cleanupCall();

    }

}


// ============================================================
// مراقبة حالة المكالمة
// ============================================================

function listenCallStatus(){

    if(unsubscribeCall){

        unsubscribeCall();

    }


    const ref =
        doc(
            db,
            "videoCalls",
            activeCall.callId
        );


    unsubscribeCall =
        onSnapshot(

            ref,

            snap => {

                if(!snap.exists()){

                    cleanupCall();

                    return;

                }


                const data =
                    snap.data();


                if(
                    data.status ===
                    "ended"
                ){

                    setCallStatus(
                        "انتهت المكالمة"
                    );


                    setTimeout(
                        cleanupCall,
                        500
                    );

                }

            }

        );

}


// ============================================================
// واجهة الاتصال
// ============================================================

function openCallPage({

    name,
    photo,
    outgoing

}){

    if(
        document.getElementById(
            "mecdCallScreen"
        )
    ){

        return;

    }


    const screen =
        document.createElement(
            "div"
        );


    screen.id =
        "mecdCallScreen";


    screen.innerHTML = `

        <div class="mecd-call-screen">

            <div class="mecd-call-avatar">

                ${
                    photo
                    ?
                    `<img src="${escapeHtml(photo)}">`
                    :
                    "👤"
                }

            </div>

            <div class="mecd-call-name">

                ${escapeHtml(name)}

            </div>

            <div
                id="mecdCallStatus"
                class="mecd-call-status">

                ${outgoing ? "اتصال..." : "جارٍ الاتصال..."}

            </div>

            <audio
                id="mecdRemoteAudio"
                autoplay>
            </audio>

            <button
                id="mecdEndCall"
                class="mecd-end-call">

                ☎

            </button>

        </div>

    `;


    addCallStyle();


    document.body.appendChild(
        screen
    );


    document
        .getElementById(
            "mecdEndCall"
        )
        .onclick =
            endCall;

}


// ============================================================
// الحالة
// ============================================================

function setCallStatus(text){

    const element =
        document.getElementById(
            "mecdCallStatus"
        );


    if(element){

        element.textContent =
            text;

    }

}


// ============================================================
// إنهاء
// ============================================================

async function endCall(){

    if(activeCall){

        try{

            await updateDoc(

                doc(
                    db,
                    "videoCalls",
                    activeCall.callId
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
                error
            );

        }

    }


    cleanupCall();

}


// ============================================================
// تنظيف
// ============================================================

function cleanupCall(){

    if(unsubscribeCall){

        unsubscribeCall();

        unsubscribeCall =
            null;

    }


    if(unsubscribeRemoteCandidates){

        unsubscribeRemoteCandidates();

        unsubscribeRemoteCandidates =
            null;

    }


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


    activeCall =
        null;

    callCandidates.clear();


    const screen =
        document.getElementById(
            "mecdCallScreen"
        );


    if(screen){

        screen.remove();

    }

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
// CSS للمكالمة
// ============================================================

function addCallStyle(){

    if(
        document.getElementById(
            "mecdCallStyle"
        )
    ){

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "mecdCallStyle";


    style.textContent = `

        #mecdCallScreen{

            position:fixed;
            inset:0;
            z-index:999999;

            background:
                radial-gradient(
                    circle at top,
                    #123d35,
                    transparent 45%
                ),
                #020504;

            color:white;

            font-family:
                Arial,
                Tahoma,
                sans-serif;

        }

        .mecd-call-screen{

            width:100%;
            height:100%;

            display:flex;

            flex-direction:column;

            align-items:center;
            justify-content:center;

        }

        .mecd-call-avatar{

           
