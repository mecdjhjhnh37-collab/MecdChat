/* =========================================
   Mecd Chat - Real Voice Call System
   WebRTC + Firestore
   Firebase v10.12.2
   ========================================= */

import {
    getApps,
    getApp
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
    setDoc,
    getDoc,
    onSnapshot,
    updateDoc,
    serverTimestamp,
    collection,
    addDoc
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =========================================
   Firebase
========================================= */

const firebaseApp =
    getApps().length
        ? getApp()
        : null;


if(!firebaseApp){

    throw new Error(
        "Firebase لم يتم تشغيله قبل تحميل call.js"
    );

}


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

        authReadyResolve =
            resolve;

    });


onAuthStateChanged(
    auth,
    user => {

        currentUser =
            user;

        authReadyResolve(
            user
        );

    }
);


/* =========================================
   WebRTC
========================================= */

let peerConnection =
    null;

let localStream =
    null;

let remoteStream =
    null;

let callListeners =
    [];

let pendingCandidates =
    [];


/* =========================================
   أدوات
========================================= */

function createCallID(){

    return (
        Date.now().toString(36) +
        "_" +
        Math.random()
            .toString(36)
            .substring(2,10)
    );

}


function addListener(unsubscribe){

    if(
        typeof unsubscribe ===
        "function"
    ){

        callListeners.push(
            unsubscribe
        );

    }

}


/* =========================================
   بدء المكالمة
========================================= */

export async function startCall({

    friendId,
    friendName,
    friendPhoto

}){

    await authReady;


    if(!currentUser){

        alert(
            "⚠️ يجب تسجيل الدخول أولاً"
        );

        return;

    }


    if(!friendId){

        alert(
            "⚠️ لم يتم تحديد الصديق"
        );

        return;

    }


    if(
        friendId ===
        currentUser.uid
    ){

        alert(
            "⚠️ لا يمكنك الاتصال بنفسك"
        );

        return;

    }


    try{

        const callId =
            createCallID();


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


        /*
         * إنشاء وثيقة المكالمة
         */

        await setDoc(

            doc(
                db,
                "calls",
                callId
            ),

            callData

        );


        /*
         * وضع المكالمة عند المستخدم الآخر
         */

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
                merge:true
            }

        );


        /*
         * فتح شاشة المكالمة
         */

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
            friendName ||
            "مستخدم Mecd"
        );

        params.set(
            "photo",
            friendPhoto ||
            ""
        );


        window.location.href =
            "call.html?" +
            params.toString();


    }catch(error){

        console.error(
            "Start call error:",
            error
        );

        alert(
            "❌ تعذر بدء المكالمة: " +
            error.message
        );

    }

}


/* =========================================
   استقبال المكالمات
========================================= */

export async function listenIncomingCalls(){

    await authReady;


    if(!currentUser)
        return null;


    const userRef =
        doc(
            db,
            "users",
            currentUser.uid
        );


    return onSnapshot(

        userRef,

        snapshot => {

            if(!snapshot.exists())
                return;


            const data =
                snapshot.data();


            const incoming =
                data.incomingCall;


            if(!incoming)
                return;


            if(
                incoming.receiverId !==
                currentUser.uid
            ){

                return;

            }


            if(
                incoming.status !==
                "ringing"
            ){

                return;

            }


            if(
                window.currentIncomingCallId ===
                incoming.callId
            ){

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

export async function getCall(
    callId
){

    if(!callId)
        return null;


    const snapshot =
        await getDoc(

            doc(
                db,
                "calls",
                callId
            )

        );


    if(!snapshot.exists())
        return null;


    return {

        id:
            snapshot.id,

        ...snapshot.data()

    };

}


/* =========================================
   الميكروفون
========================================= */

async function getMicrophone(){

    try{

        localStream =
            await navigator.mediaDevices
                .getUserMedia({

                    audio:{
                        echoCancellation:true,
                        noiseSuppression:true,
                        autoGainControl:true
                    },

                    video:false

                });


        /*
         * نضعه على window لكي
         * تتحكم شاشة call.html بالـ mute
         */

        window.localCallStream =
            localStream;


        return localStream;


    }catch(error){

        console.error(
            "Microphone error:",
            error
        );


        throw new Error(
            "لم يتم السماح باستخدام الميكروفون. افتح إعدادات الموقع واسمح بالميكروفون."
        );

    }

}


/* =========================================
   إنشاء PeerConnection
========================================= */

function createPeerConnection(
    callId
){

    const pc =
        new RTCPeerConnection({

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

        });


    /*
     * ICE
     */

    pc.onicecandidate =
        async event => {

            if(
                !event.candidate ||
                !currentUser
            ){

                return;

            }


            try{

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

            }catch(error){

                console.error(
                    "ICE send error:",
                    error
                );

            }

        };


    /*
     * الصوت القادم
     */

    pc.ontrack =
        event => {

            if(!remoteStream){

                remoteStream =
                    new MediaStream();

            }


            if(
                event.streams &&
                event.streams[0]
            ){

                event.streams[0]
                    .getTracks()
                    .forEach(
                        track => {

                            if(
                                !remoteStream
                                    .getTracks()
                                    .some(
                                        t =>
                                            t.id ===
                                            track.id
                                    )
                            ){

                                remoteStream.addTrack(
                                    track
                                );

                            }

                        }
                    );

            }else{

                if(
                    !remoteStream
                        .getTracks()
                        .some(
                            t =>
                                t.id ===
                                event.track.id
                        )
                ){

                    remoteStream.addTrack(
                        event.track
                    );

                }

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


    /*
     * تغير حالة الاتصال
     */

    pc.onconnectionstatechange =
        () => {

            console.log(
                "WebRTC state:",
                pc.connectionState
            );


            if(
                pc.connectionState ===
                "connected"
            ){

                if(
                    typeof window.onCallConnected ===
                    "function"
                ){

                    window.onCallConnected();

                }

            }


            if(
                pc.connectionState ===
                "failed"
            ){

                console.error(
                    "WebRTC connection failed"
                );

            }


            if(
                pc.connectionState ===
                "disconnected"
            ){

                console.warn(
                    "WebRTC disconnected"
                );

            }

        };


    return pc;

}


/* =========================================
   إضافة الصوت
========================================= */

function addLocalTracks(){

    if(
        !peerConnection ||
        !localStream
    ){

        return;

    }


    localStream
        .getTracks()
        .forEach(
            track => {

                /*
                 * لا نضيف نفس Track مرتين
                 */

                const alreadyAdded =
                    peerConnection
                        .getSenders()
                        .some(
                            sender =>
                                sender.track &&
                                sender.track.id ===
                                track.id
                        );


                if(!alreadyAdded){

                    peerConnection.addTrack(
                        track,
                        localStream
                    );

                }

            }
        );

}


/* =========================================
   الاستماع لوثيقة المكالمة
========================================= */

function listenCallDocument(
    callId,
    callback
){

    const ref =
        doc(
            db,
            "calls",
            callId
        );


    const unsubscribe =
        onSnapshot(

            ref,

            snapshot => {

                if(
                    !snapshot.exists()
                ){

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


    addListener(
        unsubscribe
    );


    return unsubscribe;

}


/* =========================================
   ICE Candidates
========================================= */

function listenCandidates(
    callId
){

    const ref =
        collection(
            db,
            "calls",
            callId,
            "candidates"
        );


    const unsubscribe =
        onSnapshot(

            ref,

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


                            if(
                                !currentUser
                            ){

                                return;

                            }


                            /*
                             * تجاهل الـ ICE الخاص بنا
                             */

                            if(
                                data.senderId ===
                                currentUser.uid
                            ){

                                return;

                            }


                            const candidate =
                                new RTCIceCandidate(
                                    data.candidate
                                );


                            /*
                             * إذا لم نضع Remote Description
                             * بعد، نخزن الـ candidate مؤقتاً.
                             */

                            if(
                                !peerConnection ||
                                !peerConnection
                                    .remoteDescription
                            ){

                                pendingCandidates.push(
                                    candidate
                                );

                                return;

                            }


                            try{

                                await peerConnection
                                    .addIceCandidate(
                                        candidate
                                    );

                            }catch(error){

                                console.error(
                                    "Add ICE error:",
                                    error
                                );

                            }

                        }
                    );

            },

            error => {

                console.error(
                    "ICE listener error:",
                    error
                );

            }

        );


    addListener(
        unsubscribe
    );


    return unsubscribe;

}


/* =========================================
   إضافة ICE المؤجل
========================================= */

async function flushPendingCandidates(){

    if(
        !peerConnection ||
        !peerConnection.remoteDescription
    ){

        return;

    }


    const candidates =
        [...pendingCandidates];


    pendingCandidates =
        [];


    for(
        const candidate of candidates
    ){

        try{

            await peerConnection
                .addIceCandidate(
                    candidate
                );

        }catch(error){

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
){

    await authReady;


    if(!currentUser){

        throw new Error(
            "يجب تسجيل الدخول"
        );

    }


    const call =
        await getCall(
            callId
        );


    if(!call){

        throw new Error(
            "المكالمة غير موجودة"
        );

    }


    /*
     * الميكروفون
     */

    await getMicrophone();


    /*
     * WebRTC
     */

    peerConnection =
        createPeerConnection(
            callId
        );


    addLocalTracks();


    /*
     * نبدأ الاستماع للـ ICE
     * قبل إنشاء Offer حتى لا تضيع candidates
     */

    listenCandidates(
        callId
    );


    /*
     * إنشاء Offer
     */

    const offer =
        await peerConnection
            .createOffer({

                offerToReceiveAudio:true

            });


    await peerConnection
        .setLocalDescription(
            offer
        );


    /*
     * حفظ Offer في Firestore
     */

    await updateDoc(

        doc(
            db,
            "calls",
            callId
        ),

        {

            offer:{

                type:
                    offer.type,

                sdp:
                    offer.sdp

            },

            status:
                "calling"

        }

    );


    /*
     * انتظار Answer
     */

    listenCallDocument(

        callId,

        async data => {

            if(!data){

                if(
                    typeof window.onCallEnded ===
                    "function"
                ){

                    window.onCallEnded();

                }

                return;

            }


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

                return;

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


                    await flushPendingCandidates();


                }catch(error){

                    console.error(
                        "Set answer error:",
                        error
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
){

    await authReady;


    if(!currentUser){

        throw new Error(
            "يجب تسجيل الدخول"
        );

    }


    let call =
        await getCall(
            callId
        );


    if(!call){

        throw new Error(
            "المكالمة غير موجودة"
        );

    }


    if(
        call.receiverId !==
        currentUser.uid
    ){

        throw new Error(
            "هذه المكالمة ليست لك"
        );

    }


    /*
     * ننتظر Offer إذا لم يصل بعد
     */

    if(!call.offer){

        let attempts = 0;

        while(
            !call.offer &&
            attempts < 40
        ){

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        250
                    )
            );

            call =
                await getCall(
                    callId
                );

            attempts++;

        }

    }


    if(!call.offer){

        throw new Error(
            "لم يصل طلب الاتصال."
        );

    }


    /*
     * الميكروفون
     */

    await getMicrophone();


    /*
     * PeerConnection
     */

    peerConnection =
        createPeerConnection(
            callId
        );


    addLocalTracks();


    /*
     * نبدأ استقبال ICE
     */

    listenCandidates(
        callId
    );


    /*
     * وضع Offer
     */

    await peerConnection
        .setRemoteDescription(

            new RTCSessionDescription(
                call.offer
            )

        );


    /*
     * الآن نضيف ICE الذي وصل قبل Offer
     */

    await flushPendingCandidates();


    /*
     * إنشاء Answer
     */

    const answer =
        await peerConnection
            .createAnswer({

                offerToReceiveAudio:true

            });


    await peerConnection
        .setLocalDescription(
            answer
        );


    /*
     * حفظ Answer
     */

    await updateDoc(

        doc(
            db,
            "calls",
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


    /*
     * مراقبة انتهاء المكالمة
     */

    listenCallDocument(

        callId,

        data => {

            if(
                !data ||
                data.status ===
                "ended"
            ){

                if(
                    typeof window.onCallEnded ===
                    "function"
                ){

                    window.onCallEnded();

                }

            }

        }

    );

}


/* =========================================
   مراقبة مكالمة واردة
========================================= */

export async function watchIncomingCall(
    callId
){

    await authReady;


    if(!currentUser)
        return;


    listenCallDocument(

        callId,

        data => {

            if(!data){

                if(
                    typeof window.onCallEnded ===
                    "function"
                ){

                    window.onCallEnded();

                }

                return;

            }


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

            }

        }

    );

}


/* =========================================
   إنهاء المكالمة
========================================= */

export async function endCall(
    callId
){

    if(!callId)
        return;


    try{

        await updateDoc(

            doc(
                db,
                "calls",
                callId
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
            "End call error:",
            error
        );

    }

}


/* =========================================
   حذف incomingCall
========================================= */

export async function clearIncomingCall(){

    await authReady;


    if(!currentUser)
        return;


    try{

        await updateDoc(

            doc(
                db,
                "users",
                currentUser.uid
            ),

            {

                incomingCall:null

            }

        );

    }catch(error){

        console.error(
            "Clear incoming call error:",
            error
        );

    }

}


/* =========================================
   تنظيف WebRTC
========================================= */

export async function cleanupCall(
    callId
){

    try{

        /*
         * إيقاف الميكروفون
         */

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


        window.localCallStream =
            null;


        /*
         * إغلاق WebRTC
         */

        if(peerConnection){

            peerConnection.close();

            peerConnection =
                null;

        }


        remoteStream =
            null;


        /*
         * تنظيف ICE
         */

        pendingCandidates =
            [];


        /*
         * إلغاء جميع listeners
         */

        callListeners
            .forEach(
                unsubscribe => {

                    try{

                        unsubscribe();

                    }catch{}

                }
            );


        callListeners =
            [];


        /*
         * تحديث المكالمة
         */

        if(callId){

            await endCall(
                callId
            );

        }


    }catch(error){

        console.error(
            "Cleanup error:",
            error
        );

    }

}
