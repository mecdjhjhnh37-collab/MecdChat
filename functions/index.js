const {
    onDocumentCreated
} = require(
    "firebase-functions/v2/firestore"
);

const {
    initializeApp
} = require(
    "firebase-admin/app"
);

const {
    getFirestore
} = require(
    "firebase-admin/firestore"
);

const {
    getMessaging
} = require(
    "firebase-admin/messaging"
);


/* =========================================
   Firebase Admin
========================================= */

initializeApp();


const db =
    getFirestore();


const messaging =
    getMessaging();


/* =========================================
   رسالة جديدة
========================================= */

exports.sendChatNotification =

    onDocumentCreated(

        "chats/{chatId}/messages/{messageId}",

        async event => {

            const snapshot =
                event.data;


            if(!snapshot){

                console.log(
                    "❌ لا توجد بيانات للرسالة"
                );

                return;

            }


            const message =
                snapshot.data();


            /* =====================================
               بيانات الرسالة
            ===================================== */

            const senderId =
                message.senderId;


            const receiverId =
                message.receiverId;


            const senderName =
                message.senderName ||
                "مستخدم Mecd";


            const senderPhoto =
                message.senderPhoto ||
                "";


            const text =
                message.text ||
                "لديك رسالة جديدة";


            const chatId =
                event.params.chatId;


            const messageId =
                event.params.messageId;


            /* =====================================
               التحقق
            ===================================== */

            if(!senderId){

                console.log(
                    "❌ لا يوجد senderId"
                );

                return;

            }


            if(!receiverId){

                console.log(
                    "❌ لا يوجد receiverId"
                );

                return;

            }


            /*
             * منع إرسال إشعار لنفس الشخص
             */

            if(
                senderId ===
                receiverId
            ){

                console.log(
                    "⚠️ senderId = receiverId"
                );

                return;

            }


            /* =====================================
               جلب حساب المستلم فقط
            ===================================== */

            const receiverRef =

                db
                    .collection("users")
                    .doc(receiverId);


            const receiverSnapshot =
                await receiverRef.get();


            if(
                !receiverSnapshot.exists
            ){

                console.log(
                    "❌ المستلم غير موجود:",
                    receiverId
                );

                return;

            }


            const receiverData =
                receiverSnapshot.data();


            /* =====================================
               Token المستلم فقط
            ===================================== */

            const receiverToken =
                receiverData.fcmToken;


            if(!receiverToken){

                console.log(
                    "⚠️ المستلم لا يملك FCM Token:",
                    receiverId
                );

                return;

            }


            /* =====================================
               الرسالة التي ستذهب للجهاز
               Data فقط
            ===================================== */

            const fcmMessage = {

                token:
                    receiverToken,

                data: {

                    type:
                        "chat_message",

                    chatId:
                        String(chatId),

                    messageId:
                        String(messageId),

                    senderId:
                        String(senderId),

                    receiverId:
                        String(receiverId),

                    senderName:
                        String(senderName),

                    senderPhoto:
                        String(senderPhoto),

                    messageText:
                        String(text)

                }

            };


            /* =====================================
               إرسال الإشعار
            ===================================== */

            try{

                const response =
                    await messaging.send(
                        fcmMessage
                    );


                console.log(
                    "✅ تم إرسال الإشعار للمستلم فقط:",
                    receiverId
                );


                console.log(
                    "FCM response:",
                    response
                );


            }catch(error){

                console.error(
                    "❌ FCM send error:",
                    error
                );


                /*
                 * Token منتهي أو غير صالح
                 */

                if(

                    error.code ===
                    "messaging/registration-token-not-registered"

                ){

                    try{

                        await receiverRef.update({

                            fcmToken:
                                null,

                            notificationsEnabled:
                                false

                        });


                        console.log(
                            "🧹 تم حذف FCM Token القديم"
                        );


                    }catch(cleanError){

                        console.error(
                            "Token cleanup error:",
                            cleanError
                        );

                    }

                }

            }

        }

    );
