importScripts(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"
);

importScripts(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
);


firebase.initializeApp({

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

});


const messaging =
    firebase.messaging();


/* =========================================
   استقبال الرسائل بالخلفية
========================================= */

messaging.onBackgroundMessage(

    payload => {

        console.log(
            "🔔 Mecd FCM Background:",
            payload
        );


        const data =
            payload.data || {};


        /* =====================================
           رسالة دردشة
        ===================================== */

        if(
            data.type ===
            "chat_message"
        ){

            const senderName =
                data.senderName ||
                "مستخدم Mecd";


            const messageText =
                data.messageText ||
                "لديك رسالة جديدة";


            self.registration.showNotification(

                "💬 " + senderName,

                {

                    body:
                        messageText,

                    icon:
                        data.senderPhoto ||
                        "./icon-192.png",

                    badge:
                        "./icon-192.png",

                    tag:
                        "mecd-chat-" +
                        (
                            data.chatId ||
                            "message"
                        ),

                    renotify:
                        true,

                    data: {

                        type:
                            "chat_message",

                        chatId:
                            data.chatId ||
                            "",

                        senderId:
                            data.senderId ||
                            "",

                        receiverId:
                            data.receiverId ||
                            ""

                    }

                }

            );

            return;

        }


        /* =====================================
           مكالمة واردة
        ===================================== */

        if(
            data.type ===
            "incoming_call"
        ){

            const name =
                data.callerName ||
                "مكالمة واردة";


            const photo =
                data.callerPhoto ||
                "";


            self.registration.showNotification(

                "📞 مكالمة واردة",

                {

                    body:
                        name +
                        " يتصل بك",

                    icon:
                        photo ||
                        "./icon-192.png",

                    badge:
                        "./icon-192.png",

                    tag:
                        "mecd-call",

                    renotify:
                        true,

                    requireInteraction:
                        true,

                    data: {

                        type:
                            "incoming_call",

                        callId:
                            data.callId ||
                            "",

                        callerId:
                            data.callerId ||
                            "",

                        callerName:
                            name,

                        callerPhoto:
                            photo

                    }

                }

            );

            return;

        }

    }

);


/* =========================================
   الضغط على إشعار الرسالة
========================================= */

self.addEventListener(

    "notificationclick",

    event => {

        event.notification.close();


        const data =
            event.notification.data || {};


        if(
            data.type !==
            "chat_message"
        ){

            return;

        }


        event.waitUntil(

            clients.matchAll({

                type:
                    "window",

                includeUncontrolled:
                    true

            })

            .then(

                clientList => {

                    /*
                     * إذا كان الموقع مفتوحًا
                     */

                    for(
                        const client
                        of clientList
                    ){

                        if(
                            "focus" in client
                        ){

                            return client.focus();

                        }

                    }


                    /*
                     * إذا لم يكن مفتوحًا
                     */

                    if(
                        clients.openWindow
                    ){

                        const chatUrl =

                            new URL(
                                "chat.html",
                                self.registration.scope
                            ).href;


                        return clients.openWindow(
                            chatUrl +
                            "?friend=" +
                            encodeURIComponent(
                                data.senderId || ""
                            )
                        );

                    }

                }

            )

        );

    }

);
