importScripts(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"
);

importScripts(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
);

firebase.initializeApp({
    apiKey: "AIzaSyA8ZA5fcy1Tl3hZ7_5n91xVOw06syHPGyI",
    authDomain: "mecd-tools.firebaseapp.com",
    projectId: "mecd-tools",
    storageBucket: "mecd-tools.firebasestorage.app",
    messagingSenderId: "643005547408",
    appId: "1:643005547408:web:b1719060ec340dd0e0a915"
});

const messaging =
    firebase.messaging();

messaging.onBackgroundMessage(
    payload => {

        console.log(
            "Background call notification:",
            payload
        );

        const data =
            payload.data || {};

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
                    "/icon-192.png",

                badge:
                    "/icon-192.png",

                tag:
                    "mecd-call",

                renotify:
                    true,

                requireInteraction:
                    true,

                data: {
                    callId:
                        data.callId || "",

                    callerId:
                        data.callerId || "",

                    callerName:
                        name,

                    callerPhoto:
                        photo
                }
            }
        );

    }
);
