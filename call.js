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

const auth = getAuth(app);
const db = getFirestore(app);


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
// Variables
// ============================================================

let currentUser = null;

let activeCall = null;

let peerConnection = null;

let localStream = null;

let remoteCandidates = [];

let candidateIds = new Set();

let unsubscribeIncoming = null;

let unsubscribeCall = null;

let unsubscribeCandidates = null;

let incomingCallBox = null;


// ============================================================
// Authentication
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
// Start incoming calls listener
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
            "voiceCalls"
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

                            if(activeCall){
                                return;
                            }

                            const data =
                                change.doc.data();

                            showIncomingCall(
                                change.doc.id,
                                data
                            );

                        }
                    );

            },

            error => {

                console.error(
                    "Incoming call error:",
                    error
                );

            }

        );

}


// ============================================================
// Create PeerConnection
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
                !activeCall ||
                !currentUser
            ){
                return;
            }

            const collectionName =
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
                        "voiceCalls",
                        activeCall.callId,
                        collectionName
                    ),

                    event.candidate.toJSON()

                );

            }catch(error){

                console.error(
                    "ICE candidate error:",
                    error
                );

            }

        };


    peerConnection.ontrack =
        event => {

            const audio =
                document.getElementById(
                    "mecdRemoteAudio"
                );

            if(!audio){
                return;
            }

            if(
                event.streams &&
                event.streams[0]
            ){

                audio.srcObject =
                    event.streams[0];

                audio.play()
                    .catch(
                        () => {}
                    );

            }

        };


    peerConnection.onconnectionstatechange =
        async () => {

            if(!peerConnection){
                return;
            }

            console.log(
                "Mecd Voice:",
                peerConnection.connectionState
            );


            if(
                peerConnection.connectionState ===
                "connected"
            ){

                setCallStatus(
                    "متصل"
                );

                if(activeCall){

                    try{

                        await updateDoc(

                            doc(
                                db,
                                "voiceCalls",
                                activeCall.callId
                            ),

                            {
                                status:
                                    "connected"
                            }

                        );

                    }catch(error){

                        console.error(
                            error
                        );

                    }

                }

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
// Microphone
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
// Add local audio
// ============================================================

function addLocalAudio(){

    if(
        !peerConnection ||
        !localStream
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
// Listen ICE candidates
// ============================================================

function listenCandidates(
    collectionName
){

    if(unsubscribeCandidates){

        unsubscribeCandidates();

        unsubscribeCandidates =
            null;

    }

    if(!activeCall){
        return;
    }

    const ref =
        collection(
            db,
            "voiceCalls",
            activeCall.callId,
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
                        candidateIds.has(
                            change.doc.id
                        )
                    ){
                        continue;
                    }

                    candidateIds.add(
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

                        }catch(error){

                            console.error(
                                "ICE error:",
                                error
                            );

                        }

                    }else{

                        remoteCandidates.push(
                            candidate
                        );

                    }

                }

            }

        );

}


// ============================================================
// Apply queued candidates
// ============================================================

async function applyQueuedCandidates(){

    if(
        !peerConnection ||
        !peerConnection.remoteDescription
    ){
        return;
    }

    for(
        const candidate
        of remoteCandidates
    ){

        try{

            await peerConnection
                .addIceCandidate(
                    candidate
                );

        }catch(error){

            console.error(
                "Queued ICE error:",
                error
            );

        }

    }

    remoteCandidates = [];

}


// ============================================================
// START CALL
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


    // --------------------------------------------------------
    // إنشاء ID للمكالمة أولاً
    // --------------------------------------------------------

    const callRef =
        doc(
            collection(
                db,
                "voiceCalls"
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


    // --------------------------------------------------------
    // فتح شاشة المكالمة مباشرة
    // --------------------------------------------------------

    openCallPage({

        name:
            activeCall.friendName,

        photo:
            activeCall.friendPhoto,

        outgoing:true

    });


    setCallStatus(
        "اتصال..."
    );


    // --------------------------------------------------------
    // إنشاء طلب المكالمة فوراً
    // --------------------------------------------------------

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

            status:
                "ringing",

            createdAt:
                serverTimestamp()

        }

    );


    // --------------------------------------------------------
    // الاستماع للمكالمة
    // --------------------------------------------------------

    unsubscribeCall =
        onSnapshot(

            callRef,

            async snap => {

                if(!snap.exists()){

                    cleanupCall();

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
                        700
                    );

                    return;

                }


                // ------------------------------------------------
                // الطرف الآخر قبل المكالمة
                // ------------------------------------------------

                if(
                    data.answer &&
                    peerConnection &&
                    !peerConnection.remoteDescription
                ){

                    await peerConnection
                        .setRemoteDescription(

                            new RTCSessionDescription(
                                data.answer
                            )

                        );


                    await applyQueuedCandidates();

                    setCallStatus(
                        "جارٍ الاتصال..."
                    );

                }

            }

        );


    // --------------------------------------------------------
    // تجهيز WebRTC بعد إنشاء الطلب
    // --------------------------------------------------------

    try{

        await getMicrophone();

        createPeer();

        addLocalAudio();

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

    }catch(error){

        console.error(
            "Start call error:",
            error
        );


        try{

            await updateDoc(

                callRef,

                {
                    status:
                        "ended"
                }

            );

        }catch(e){}


        cleanupCall();

        throw error;

    }

}


// ============================================================
// Incoming call UI
// ============================================================

function showIncomingCall(
    callId,
    data
){

    if(
        incomingCallBox ||
        activeCall
    ){
        return;
    }


    const box =
        document.createElement(
            "div"
        );

    incomingCallBox =
        box;

    box.id =
        "mecdIncomingCall";


    const photo =
        data.callerPhoto
        ?
        `<img src="${escapeHtml(data.callerPhoto)}">`
        :
        "👤";


    box.innerHTML = `

        <div class="mecd-incoming-card">

            <div class="mecd-incoming-avatar">

                ${photo}

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


    const accept =
        document.getElementById(
            "mecdAcceptCall"
        );


    const reject =
        document.getElementById(
            "mecdRejectCall"
        );


    accept.onclick =
        async () => {

            box.remove();

            incomingCallBox =
                null;

            await answerCall(
                callId,
                data
            );

        };


    reject.onclick =
        async () => {

            box.remove();

            incomingCallBox =
                null;

            try{

                await updateDoc(

                    doc(
                        db,
                        "voiceCalls",
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
// ANSWER CALL
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
            "اتصال..."
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


        await applyQueuedCandidates();


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
                "voiceCalls",
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
            "Answer call error:",
            error
        );


        try{

            await updateDoc(

                doc(
                    db,
                    "voiceCalls",
                    callId
                ),

                {
                    status:
                        "ended"
                }

            );

        }catch(e){}


        cleanupCall();

        alert(
            "❌ تعذر تشغيل المكالمة\n\n" +
            error.message
        );

    }

}


// ============================================================
// Call status
// ============================================================

function listenCallStatus(){

    if(
        !activeCall
    ){
        return;
    }


    if(unsubscribeCall){

        unsubscribeCall();

    }


    const ref =
        doc(
            db,
            "voiceCalls",
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
                        600
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
// Call screen
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

                ${outgoing ? "اتصال..." : "اتصال..."}

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
// Status UI
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
// End call
// ============================================================

async function endCall(){

    if(activeCall){

        try{

            await updateDoc(

                doc(
                    db,
                    "voiceCalls",
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
// Cleanup
// ============================================================

function cleanupCall(){

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


    remoteCandidates =
        [];

    candidateIds.clear();

    activeCall =
        null;


    const screen =
        document.getElementById(
            "mecdCallScreen"
        );

    if(screen){

        screen.remove();

    }

}


// ============================================================
// Escape HTML
// ============================================================

function escapeHtml(value){

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
// Call CSS
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
                linear-gradient(
                    180deg,
                    #07110f,
                    #020504
                );

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

            width:105px;
            height:105px;

            border-radius:32px;

            background:#12352c;

            display:flex;

            align-items:center;
            justify-content:center;

            overflow:hidden;

            font-size:48px;

            box-shadow:
                0 15px 50px
                rgba(0,0,0,.45);

        }


        .mecd-call-avatar img{

            width:100%;
            height:100%;

            object-fit:cover;

        }


        .mecd-call-name{

            margin-top:22px;

            font-size:23px;

            font-weight:bold;

        }


        .mecd-call-status{

            margin-top:10px;

            color:#00e889;

            font-size:15px;

        }


        #mecdRemoteAudio{

            position:absolute;

            width:1px;
            height:1px;

            opacity:.01;

        }


        .mecd-end-call{

            position:absolute;

            bottom:55px;

            width:65px;
            height:65px;

            border:0;

            border-radius:50%;

            background:#ff4d4d;

            color:white;

            font-size:28px;

            cursor:pointer;

            transform:rotate(135deg);

            box-shadow:
                0 8px 30px
                rgba(255,0,0,.25);

        }


        .mecd-end-call:active{

            transform:
                rotate(135deg)
                scale(.92);

        }


        #mecdIncomingCall{

            position:fixed;

            inset:0;

            z-index:1000000;

            display:flex;

            align-items:center;

            justify-content:center;

            padding:20px;

            background:
                rgba(0,0,0,.72);

            backdrop-filter:
                blur(8px);

        }


        .mecd-incoming-card{

            width:100%;

            max-width:360px;

            padding:30px 22px;

            border-radius:28px;

            background:#0b1512;

            border:
                1px solid
                rgba(0,232,137,.15);

            text-align:center;

            box-shadow:
                0 20px 60px
                rgba(0,0,0,.6);

        }


        .mecd-incoming-avatar{

            width:90px;
            height:90px;

            margin:auto;

            border-radius:27px;

            background:#12352c;

            display:flex;

            align-items:center;
            justify-content:center;

            overflow:hidden;

            font-size:40px;

        }


        .mecd-incoming-avatar img{

            width:100%;
            height:100%;

            object-fit:cover;

        }


        .mecd-incoming-name{

            margin-top:18px;

            font-size:21px;

            font-weight:bold;

        }


        .mecd-incoming-text{

            margin-top:8px;

            color:#00e889;

            font-size:14px;

        }


        .mecd-incoming-buttons{

            display:flex;

            gap:10px;

            margin-top:25px;

        }


        .mecd-incoming-buttons button{

            flex:1;

            height:48px;

            border:0;

            border-radius:15px;

            font-size:15px;

            font-weight:bold;

            cursor:pointer;

        }


        #mecdAcceptCall{

            background:#00e889;

            color:#00150e;

        }


        #mecdRejectCall{

            background:#18231f;

            color:white;

        }

    `;


    document.head.appendChild(
        style
    );

}


// ============================================================
// Incoming style
// ============================================================

function addIncomingStyle(){

    addCallStyle();

}


// ============================================================
// Standalone call.html support
// ============================================================

window.MecdVoiceCall = {

    startCall,

    answerCall,

    endCall

};
