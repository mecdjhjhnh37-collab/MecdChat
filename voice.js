import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


const voiceButton =
  document.getElementById("voiceButton");


let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];

let isRecording = false;
let isStarting = false;


/* =================================================
   بدء التسجيل عند الضغط على زر الميكروفون
================================================= */

voiceButton.addEventListener(
  "pointerdown",
  async (event) => {

    event.preventDefault();

    if (isRecording || isStarting)
      return;

    isStarting = true;

    try {

      await startRecording();

    } catch (error) {

      console.error(
        "خطأ في تشغيل الميكروفون:",
        error
      );

      resetVoice();

      alert(
        "لم يتم السماح بالميكروفون"
      );

    } finally {

      isStarting = false;

    }

  }
);


/* =================================================
   رفع الإصبع = إنهاء التسجيل
================================================= */

voiceButton.addEventListener(
  "pointerup",
  (event) => {

    event.preventDefault();

    stopRecording();

  }
);


/* =================================================
   إلغاء اللمس
================================================= */

voiceButton.addEventListener(
  "pointercancel",
  () => {

    stopRecording();

  }
);


/* =================================================
   بدء التسجيل
================================================= */

async function startRecording() {

  /* التأكد أن Firebase جاهز */

  if (
    !window.storage ||
    !window.chatDB ||
    !window.chatID ||
    !window.chatUser ||
    !window.chatFriend
  ) {

    throw new Error(
      "Firebase غير جاهز"
    );

  }


  /* التأكد من دعم الميكروفون */

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "المتصفح لا يدعم الميكروفون"
    );

  }


  /* تشغيل الميكروفون */

  audioStream =
    await navigator.mediaDevices.getUserMedia({
      audio: true
    });


  /* اختيار صيغة الصوت */

  let mimeType = "";


  if (
    MediaRecorder.isTypeSupported(
      "audio/webm;codecs=opus"
    )
  ) {

    mimeType =
      "audio/webm;codecs=opus";

  }

  else if (
    MediaRecorder.isTypeSupported(
      "audio/webm"
    )
  ) {

    mimeType =
      "audio/webm";

  }


  /* إنشاء MediaRecorder */

  if (mimeType) {

    mediaRecorder =
      new MediaRecorder(
        audioStream,
        {
          mimeType: mimeType
        }
      );

  }

  else {

    mediaRecorder =
      new MediaRecorder(
        audioStream
      );

  }


  audioChunks = [];


  /* استقبال أجزاء الصوت */

  mediaRecorder.ondataavailable =
    (event) => {

      if (
        event.data &&
        event.data.size > 0
      ) {

        audioChunks.push(
          event.data
        );

      }

    };


  /* عند انتهاء التسجيل */

  mediaRecorder.onstop =
    async () => {

      await finishRecording();

    };


  /* بدء التسجيل */

  mediaRecorder.start();


  isRecording = true;


  voiceButton.textContent =
    "🔴";


  voiceButton.classList.add(
    "recording"
  );


  console.log(
    "🎤 بدأ التسجيل"
  );

}


/* =================================================
   إيقاف التسجيل
================================================= */

function stopRecording() {

  if (!isRecording)
    return;


  if (
    !mediaRecorder
  )
    return;


  if (
    mediaRecorder.state === "inactive"
  )
    return;


  console.log(
    "⏹️ إيقاف التسجيل"
  );


  mediaRecorder.stop();

}


/* =================================================
   إنهاء التسجيل
================================================= */

async function finishRecording() {

  try {

    /* إيقاف الميكروفون */

    stopMicrophone();


    /* التأكد أن الصوت موجود */

    if (
      !audioChunks ||
      audioChunks.length === 0
    ) {

      throw new Error(
        "لم يتم تسجيل صوت"
      );

    }


    /* معرفة نوع الصوت */

    const mimeType =
      mediaRecorder &&
      mediaRecorder.mimeType
        ?
        mediaRecorder.mimeType
        :
        "audio/webm";


    /* إنشاء ملف الصوت */

    const blob =
      new Blob(
        audioChunks,
        {
          type: mimeType
        }
      );


    if (blob.size === 0) {

      throw new Error(
        "ملف الصوت فارغ"
      );

    }


    console.log(
      "🎵 حجم الصوت:",
      blob.size
    );


    /* =================================================
       رفع الصوت إلى Firebase Storage
    ================================================= */

    const fileName =
      "voices/" +
      window.chatID +
      "/" +
      window.chatUser.uid +
      "_" +
      Date.now() +
      ".webm";


    const voiceRef =
      ref(
        window.storage,
        fileName
      );


    console.log(
      "⬆️ رفع الصوت..."
    );


    await uploadBytes(
      voiceRef,
      blob,
      {
        contentType: "audio/webm"
      }
    );


    /* الحصول على رابط الصوت */

    const audioURL =
      await getDownloadURL(
        voiceRef
      );


    console.log(
      "✅ تم رفع الصوت"
    );


    /* =================================================
       حفظ الرسالة في Firestore
    ================================================= */

    await addDoc(

      collection(
        window.chatDB,
        "chats",
        window.chatID,
        "messages"
      ),

      {

        type: "voice",

        audio: audioURL,

        senderId:
          window.chatUser.uid,

        receiverId:
          window.chatFriend.uid,

        createdAt:
          serverTimestamp()

      }

    );


    console.log(
      "✅ تم حفظ الصوت في الدردشة"
    );


  }

  catch (error) {

    console.error(
      "❌ خطأ في إرسال الصوت:",
      error
    );


    alert(
      "حدث خطأ أثناء حفظ الرسالة الصوتية"
    );

  }

  finally {

    resetVoice();

  }

}


/* =================================================
   إيقاف الميكروفون
================================================= */

function stopMicrophone() {

  if (!audioStream)
    return;


  audioStream
    .getTracks()
    .forEach(
      track => {

        track.stop();

      }
    );


  audioStream = null;

}


/* =================================================
   إعادة الزر للوضع الطبيعي
================================================= */

function resetVoice() {

  stopMicrophone();


  mediaRecorder = null;

  audioChunks = [];

  audioStream = null;

  isRecording = false;

  isStarting = false;


  voiceButton.textContent =
    "🎤";


  voiceButton.classList.remove(
    "recording"
  );

}
