/* =========================================
   Mecd Chat
   Messages + Notifications + Calls
   Firebase v10.12.2
========================================= */

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
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    deleteDoc,
    updateDoc,
    arrayUnion,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    getMessaging,
    getToken,
    isSupported
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";


/* =========================================
   Firebase
========================================= */

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


const appFirebase =
    initializeApp(firebaseConfig);

const auth =
    getAuth(appFirebase);

const db =
    getFirestore(appFirebase);


/* =========================================
   عناصر الصفحة
========================================= */

const $ =
    id => document.getElementById(id);

const loading =
    $("loading");

const app =
    $("app");

const messages =
    $("messages");

const messageInput =
    $("messageInput");

const sendButton =
    $("sendButton");

const friendName =
    $("friendName");

const friendAvatar =
    $("friendAvatar");

const friendStatus =
    $("friendStatus");

const backButton =
    $("backButton");

const callButton =
    $("callButton");

const videoButton =
    $("videoButton");


/* =========================================
   المتغيرات
========================================= */

let currentUser = null;
let friendUser = null;
let chatID = null;

let unsubscribeMessages = null;
let unsubscribeFriendStatus = null;

let presenceInterval = null;
let callModule = null;

let notificationReady = false;


/* =========================================
   حماية النص
========================================= */

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


/* =========================================
   Service Worker + FCM
========================================= */

async function prepareNotifications(){

    try{

        if(
            !("Notification" in window)
        ){

            console.log(
                "❌ Notification API غير مدعوم"
            );

            return false;
        }


        /*
         * لا نطلب الإذن كل مرة.
         */

        if(
            Notification.permission ===
            "default"
        ){

            try{

                await Notification.requestPermission();

            }catch(error){

                console.log(
                    "Notification permission error:",
                    error
                );

            }

        }


        if(
            Notification.permission !==
            "granted"
        ){

            console.log(
                "❌ الإشعارات غير مسموحة"
            );

            return false;
        }


        /*
         * تسجيل Service Worker إذا كان موجوداً.
         */

        let registration = null;

        if(
            "serviceWorker" in navigator
        ){

            try{

                registration =
                    await navigator.serviceWorker.register(
                        "./firebase-messaging-sw.js"
                    );

                console.log(
                    "✅ Service Worker جاهز"
                );

            }catch(error){

                console.log(
                    "⚠️ Service Worker غير جاهز:",
                    error
                );

            }

        }


        /*
         * FCM اختياري.
         */

        try{

            const supported =
                await isSupported();

            if(
                supported &&
                registration
            ){

                const messaging =
                    getMessaging(appFirebase);

                const token =
                    await getToken(
                        messaging,
                        {
                            vapidKey:
                                "BG2QNrIS2QZhTBBWNf8HfWHCIcAEHZzNZkMp8StuwmT1y1OEPkcu2_yK00Y2aGRh1LyAEyyzLnSYbbhpq13u7EQ",

                            serviceWorkerRegistration:
                                registration
                        }
                    );


                if(token){

                    await setDoc(

                        doc(
                            db,
                            "users",
                            currentUser.uid
                        ),

                        {
                            fcmToken:
                                token,

                            notificationsEnabled:
                                true,

                            notificationUpdatedAt:
                                serverTimestamp()
                        },

                        {
                            merge:true
                        }

                    );

                    console.log(
                        "✅ FCM Token محفوظ"
                    );

                }

            }

        }catch(error){

            console.log(
                "⚠️ FCM Token غير متاح:",
                error
            );

        }


        notificationReady = true;

        return true;

    }catch(error){

        console.error(
            "Notification setup error:",
            error
        );

        return false;

    }

}


/* =========================================
   الإشعار
========================================= */

function showIncomingMessageNotification(
    data
){

    /*
     * الحماية الأهم:
     *
     * الإشعار يظهر فقط إذا كان
     * currentUser هو receiverId.
     */

    if(
        !currentUser ||
        !data ||
        data.receiverId !== currentUser.uid ||
        data.senderId === currentUser.uid
    ){

        return;

    }


    if(
        !notificationReady ||
        Notification.permission !==
        "granted"
    ){

        return;

    }


    const senderName =
        data.senderName ||
        "رسالة جديدة";


    const body =
        data.type === "voice"
        ? "🎤 رسالة صوتية"
        : (
            data.text ||
            "لديك رسالة جديدة"
        );


    try{

        new Notification(
            "💬 " + senderName,
            {
                body:
                    body,

                icon:
                    "./icon-192.png",

                badge:
                    "./icon-192.png",

                tag:
                    "mecd-message-" +
                    (
                        data.messageId ||
                        Date.now()
                    ),

                renotify:
                    true
            }
        );

        console.log(
            "🔔 إشعار للـ receiver فقط:",
            currentUser.uid
        );

    }catch(error){

        console.error(
            "Notification error:",
            error
        );

    }

}


/* =========================================
   Chat ID
========================================= */

function createChatID(a,b){

    return [
        a,
        b
    ]
    .sort()
    .join("_");

}


/* =========================================
   Presence
========================================= */

async function updateMyPresence(
    online = true
){

    if(!currentUser)
        return;

    try{

        await setDoc(

            doc(
                db,
                "users",
                currentUser.uid
            ),

            {
                online:
                    online,

                lastSeen:
                    serverTimestamp()
            },

            {
                merge:true
            }

        );

    }catch(error){

        console.error(
            "Presence error:",
            error
        );

    }

}


function startPresence(){

    updateMyPresence(true);

    if(presenceInterval){

        clearInterval(
            presenceInterval
        );

    }


    presenceInterval =
        setInterval(
            () => {

                if(
                    document.visibilityState ===
                    "visible"
                ){

                    updateMyPresence(true);

                }

            },
            10000
        );

}


function stopPresence(){

    if(presenceInterval){

        clearInterval(
            presenceInterval
        );

        presenceInterval =
            null;

    }


    if(currentUser){

        updateMyPresence(false);

    }

}


/* =========================================
   تحميل الصديق
========================================= */

async function loadFriend(){

    const id =
        new URLSearchParams(
            location.search
        ).get("friend");


    if(!id){

        throw new Error(
            "لا يوجد صديق في الرابط"
        );

    }


    const userDoc =
        await getDoc(

            doc(
                db,
                "users",
                id
            )

        );


    if(!userDoc.exists()){

        throw new Error(
            "المستخدم غير موجود"
        );

    }


    const data =
        userDoc.data();


    friendUser = {

        uid:
            id,

        name:
            data.name ||
            "مستخدم Mecd",

        photo:
            data.photo ||
            ""

    };


    friendName.textContent =
        friendUser.name;


    if(friendUser.photo){

        friendAvatar.innerHTML =
            "";

        const img =
            document.createElement("img");

        img.src =
            friendUser.photo;

        img.alt =
            "صورة الحساب";

        friendAvatar.appendChild(
            img
        );

    }else{

        friendAvatar.innerHTML =
            "👤";

    }


    chatID =
        createChatID(
            currentUser.uid,
            friendUser.uid
        );


    window.chatID =
        chatID;

    window.chatUser =
        currentUser;

    window.chatFriend =
        friendUser;


    await setDoc(

        doc(
            db,
            "chats",
            chatID
        ),

        {
            members:[
                currentUser.uid,
                friendUser.uid
            ],

            updatedAt:
                serverTimestamp()
        },

        {
            merge:true
        }

    );


    listenFriendStatus();

}


/* =========================================
   حالة الصديق
========================================= */

function listenFriendStatus(){

    if(!friendUser)
        return;


    if(unsubscribeFriendStatus){

        unsubscribeFriendStatus();

    }


    unsubscribeFriendStatus =
        onSnapshot(

            doc(
                db,
                "users",
                friendUser.uid
            ),

            snapshot => {

                if(!snapshot.exists()){

                    friendStatus.textContent =
                        "● غير متصل";

                    friendStatus.classList.remove(
                        "online"
                    );

                    return;

                }


                const data =
                    snapshot.data();


                const lastSeen =
                    data.lastSeen?.toMillis?.() ||
                    0;


                const online =
                    data.online === true &&
                    lastSeen > 0 &&
                    Date.now() - lastSeen < 30000;


                friendStatus.textContent =
                    online
                    ? "● متصل"
                    : "● غير متصل";


                friendStatus.classList.toggle(
                    "online",
                    online
                );

            },

            error => {

                console.error(
                    "Friend status error:",
                    error
                );

            }

        );

}


/* =========================================
   عرض الرسائل
========================================= */

function renderMessage(
    id,
    data
){

    if(
        Array.isArray(data.deletedFor) &&
        data.deletedFor.includes(
            currentUser.uid
        )
    ){

        return null;

    }


    const box =
        document.createElement("div");


    box.className =
        "message " +
        (
            data.senderId ===
            currentUser.uid
            ? "mine"
            : "other"
        );


    if(
        data.type === "voice"
    ){

        const audio =
            document.createElement("audio");

        audio.controls =
            true;

        audio.src =
            data.audio || "";

        audio.style.width =
            "230px";

        audio.style.maxWidth =
            "100%";

        box.appendChild(
            audio
        );

    }else{

        box.appendChild(
            document.createTextNode(
                data.text || ""
            )
        );

    }


    const time =
        document.createElement("span");

    time.className =
        "time";


    if(data.createdAt?.toDate){

        time.textContent =
            data.createdAt
                .toDate()
                .toLocaleTimeString(
                    "ar",
                    {
                        hour:"2-digit",
                        minute:"2-digit"
                    }
                );

    }


    box.appendChild(
        time
    );


    addMessageActions(
        box,
        id,
        data.senderId === currentUser.uid
    );


    return box;

}


/* =========================================
   استقبال الرسائل
========================================= */

function listenMessages(){

    if(unsubscribeMessages){

        unsubscribeMessages();

    }


    const ref =
        collection(
            db,
            "chats",
            chatID,
            "messages"
        );


    const q =
        query(
            ref,
            orderBy(
                "createdAt",
                "asc"
            )
        );


    let firstSnapshot =
        true;


    unsubscribeMessages =
        onSnapshot(

            q,

            snapshot => {

                /*
                 * إعادة رسم الرسائل بشكل آمن.
                 */

                messages.innerHTML =
                    "";


                let realCount =
                    0;


                snapshot.forEach(
                    messageDoc => {

                        const data =
                            messageDoc.data();


                        const element =
                            renderMessage(
                                messageDoc.id,
                                data
                            );


                        if(element){

                            messages.appendChild(
                                element
                            );

                            realCount++;

                        }

                    }
                );


                if(realCount === 0){

                    const empty =
                        document.createElement(
                            "div"
                        );

                    empty.className =
                        "empty";

                    empty.innerHTML =
                        "💬<br>ابدأ المحادثة الآن";

                    messages.appendChild(
                        empty
                    );

                }


                /*
                 * =====================================
                 * 🔔 الإشعار
                 * =====================================
                 *
                 * أول تحميل:
                 * لا نرسل إشعارات للرسائل القديمة.
                 *
                 * بعد أول تحميل:
                 * أي رسالة جديدة يتم فحص receiverId لها.
                 */

                if(!firstSnapshot){

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


                                /*
                                 * هذا هو الشرط الأساسي.
                                 *
                                 * محمد:
                                 * receiverId = أحمد
                                 *
                                 * محمد لن يمر من هذا الشرط.
                                 *
                                 * أحمد:
                                 * receiverId = أحمد
                                 *
                                 * أحمد سيمر من الشرط.
                                 */

                                if(
                                    data.receiverId ===
                                    currentUser.uid &&

                                    data.senderId !==
                                    currentUser.uid
                                ){

                                    showIncomingMessageNotification({

                                        ...data,

                                        messageId:
                                            change.doc.id

                                    });

                                }

                            }
                        );

                }


                firstSnapshot =
                    false;


                requestAnimationFrame(
                    () => {

                        messages.scrollTop =
                            messages.scrollHeight;

                    }
                );

            },

            error => {

                console.error(
                    "Messages error:",
                    error
                );

            }

        );

}


/* =========================================
   إرسال الرسالة
========================================= */

async function sendMessage(){

    const text =
        messageInput.value.trim();


    if(
        !text ||
        !currentUser ||
        !friendUser ||
        !chatID
    ){

        return;

    }


    sendButton.disabled =
        true;


    try{

        await addDoc(

            collection(
                db,
                "chats",
                chatID,
                "messages"
            ),

            {
                text:
                    text,

                senderId:
                    currentUser.uid,

                receiverId:
                    friendUser.uid,

                senderName:
                    currentUser.displayName ||
                    currentUser.email?.split("@")[0] ||
                    "مستخدم Mecd",

                type:
                    "text",

                createdAt:
                    serverTimestamp()
            }

        );


        /*
         * ❌ لا يوجد هنا:
         *
         * new Notification(...)
         *
         * لأن المرسل لا يجب أن تصله
         * notification.
         */


        messageInput.value =
            "";

        messageInput.focus();


    }catch(error){

        console.error(
            "Send message error:",
            error
        );


        alert(
            "حدث خطأ أثناء إرسال الرسالة\n\n" +
            error.message
        );

    }


    sendButton.disabled =
        false;

}


/* =========================================
   أزرار الرسائل
========================================= */

function removeMenus(){

    document
        .querySelectorAll(
            ".message-menu"
        )
        .forEach(
            menu =>
                menu.remove()
        );

}


function addMessageActions(
    element,
    id,
    mine
){

    let timer = null;


    const cancel = () => {

        if(timer){

            clearTimeout(timer);

            timer =
                null;

        }

    };


    element.addEventListener(
        "pointerdown",
        () => {

            cancel();

            timer =
                setTimeout(
                    showDeleteMenu,
                    500
                );

        }
    );


    element.addEventListener(
        "pointerup",
        cancel
    );


    element.addEventListener(
        "pointercancel",
        cancel
    );


    element.addEventListener(
        "pointerleave",
        cancel
    );


    element.addEventListener(
        "contextmenu",
        e => {

            e.preventDefault();

            showDeleteMenu();

        }
    );


    function showDeleteMenu(){

        removeMenus();


        const menu =
            document.createElement(
                "div"
            );

        menu.className =
            "message-menu";


        const button =
            document.createElement(
                "button"
            );


        button.textContent =
            mine
            ? "🗑️ إلغاء الإرسال"
            : "🗑️ حذف لدي";


        button.onclick =
            async e => {

                e.stopPropagation();


                try{

                    const messageRef =
                        doc(
                            db,
                            "chats",
                            chatID,
                            "messages",
                            id
                        );


                    if(mine){

                        await deleteDoc(
                            messageRef
                        );

                    }else{

                        await updateDoc(
                            messageRef,
                            {
                                deletedFor:
                                    arrayUnion(
                                        currentUser.uid
                                    )
                            }
                        );

                    }


                    removeMenus();

                }catch(error){

                    console.error(
                        "Delete error:",
                        error
                    );

                }

            };


        menu.appendChild(
            button
        );


        element.appendChild(
            menu
        );

    }

}


document.addEventListener(
    "pointerdown",
    e => {

        if(
            !e.target.closest(
                ".message-menu"
            )
        ){

            removeMenus();

        }

    }
);


/* =========================================
   إرسال
========================================= */

sendButton.addEventListener(
    "click",
    sendMessage
);


messageInput.addEventListener(
    "keydown",
    e => {

        if(e.key === "Enter"){

            e.preventDefault();

            sendMessage();

        }

    }
);


/* =========================================
   المكالمة
========================================= */

callButton.addEventListener(
    "click",
    async () => {

        if(!currentUser){

            alert(
                "⚠️ يجب تسجيل الدخول أولاً"
            );

            return;

        }


        if(!friendUser){

            alert(
                "⚠️ لم يتم تحميل الصديق"
            );

            return;

        }


        try{

            if(!callModule){

                callModule =
                    await import(
                        "./call.js"
                    );

            }


            await callModule.startCall({

                friendId:
                    friendUser.uid,

                friendName:
                    friendUser.name,

                friendPhoto:
                    friendUser.photo

            });

        }catch(error){

            console.error(
                "Call error:",
                error
            );


            alert(
                "❌ تعذر بدء المكالمة\n\n" +
                (
                    error.message ||
                    ""
                )
            );

        }

    }
);


/* =========================================
   فيديو
========================================= */

videoButton.addEventListener(
    "click",
    () => {

        alert(
            "📹 مكالمة الفيديو قيد التطوير"
        );

    }
);


/* =========================================
   الرجوع
========================================= */

backButton.addEventListener(
    "click",
    () => {

        if(unsubscribeMessages){

            unsubscribeMessages();

        }


        if(unsubscribeFriendStatus){

            unsubscribeFriendStatus();

        }


        stopPresence();

        history.back();

    }
);


/* =========================================
   Visibility
========================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if(!currentUser)
            return;


        if(
            document.visibilityState ===
            "visible"
        ){

            updateMyPresence(true);

        }else{

            updateMyPresence(false);

        }

    }
);


/* =========================================
   تشغيل التطبيق
========================================= */

onAuthStateChanged(
    auth,
    async user => {

        if(!user){

            loading.textContent =
                "يجب تسجيل الدخول أولاً";

            return;

        }


        currentUser =
            user;


        try{

            startPresence();


            /*
             * تجهيز الإشعارات.
             */

            await prepareNotifications();


            /*
             * تحميل الصديق.
             */

            await loadFriend();


            /*
             * بدء مراقبة الرسائل.
             */

            listenMessages();


            /*
             * إظهار التطبيق.
             */

            loading.style.display =
                "none";

            app.style.display =
                "flex";


        }catch(error){

            console.error(
                error
            );


            stopPresence();


            loading.innerHTML =
                `
                <div style="
                    text-align:center;
                    padding:20px;
                ">
                    ⚠️ تعذر فتح الدردشة
                    <br>
                    <small style="color:#777">
                        ${escapeHtml(
                            error.message ||
                            "حدث خطأ"
                        )}
                    </small>
                </div>
                `;

        }

    }
);
