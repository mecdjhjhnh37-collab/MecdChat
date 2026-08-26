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


// ======================================================
// زر الميكروفون
// ======================================================

const voiceButton =
  document.getElementById("voiceButton");


if (!voiceButton) {

  console.error(
    "voiceButton غير موجود في الصفحة"
  );

} else {


// منع المتصفح من التعامل مع اللمس بطريقة تسبب مشاكل
voiceButton.style.touchAction = "none";


// ======================================================
// المتغيرات
// ======================================================

let mediaRecorder = null;

let audioStream = null;

let audioChunks = [];

let isRecording = false;

let isStarting = false;

let stopRequested = false;

let sendingVoice = false;


// ======================================================
// الضغط على زر الميكروفون
// ======================================================

voiceButton.addEventListener(
  "pointerdown",
  async (event) => {

    event.preventDefault();

    // تثبيت المؤشر على الزر
    try {

      if (
        voiceButton.setPointerCapture &&
        event.pointerId !== undefined
      ) {

        voiceButton.setPointerCapture(
          event.pointerId
        );

      }

    } catch (error) {

      console.log(
        "Pointer capture error:",
        error
      );

    }


    // لا تبدأ تسجيل ثاني
    if (
      isRecording ||
      isStarting ||
      sendingVoice
    ) {

      return;

    }


    isStarting = true;

    stopRequested = false;


    try {

      await startRecording();

    }

    catch (error) {

      console.error(
        "Start recording error:",
        error
      );


      stopMicrophone();

      resetVoice();


      if (
        error.name === "NotAllowedError"
      ) {

        alert(
          "لم يتم السماح باستخدام الميكروفون"
        );

      }

      else {

        alert(
          "تعذر تشغيل الميكروفون"
        );

      }

    }

    finally {

      isStarting = false;

    }


    // إذا رفع المستخدم إصبعه
    // أثناء انتظار فتح الميكروفون
    if (
      stopRequested &&
      isRecording
    ) {

      stopRecording();

    }

  }
);


// ======================================================
// رفع الإصبع = إيقاف التسجيل
// ======================================================

voiceButton.addEventListener(
  "pointerup",
  (event) => {

    event.preventDefault();

    stopRequested = true;

    stopRecording();

  }
);


// ======================================================
// إلغاء اللمس
// ======================================================

voiceButton.addEventListener(
  "pointercancel",
  (event) => {

    event.preventDefault();

    stopRequested = true;

    stopRecording();

  }
);


// ======================================================
// بدء التسجيل
// ======================================================

async function startRecording() {

  // -----------------------------------------------
  // التأكد من أن Firebase جاهز
  // -----------------------------------------------

  if (
    !window.storage ||
    !window.chatDB ||
    !window.chatID ||
    !window.chatUser ||
    !window.chatFriend
  ) {

    throw new Error(
      "Firebase variables are missing"
    );

  }


  // -----------------------------------------------
  // التأكد من دعم الميكروفون
  // -----------------------------------------------

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "Microphone is not supported"
    );

  }


  if (
    typeof MediaRecorder === "undefined"
  ) {

    throw new Error(
      "MediaRecorder is not supported"
    );

  }


  // -----------------------------------------------
  // تشغيل الميكروفون
  // -----------------------------------------------

  audioStream =
    await navigator.mediaDevices.getUserMedia({
      audio: true
    });


  // -----------------------------------------------
  // اختيار صيغة الصوت
  // -----------------------------------------------

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

  else if (
    MediaRecorder.isTypeSupported(
      "audio/mp4"
    )
  ) {

    mimeType =
      "audio/mp4";

  }


  // -----------------------------------------------
  // إنشاء MediaRecorder
  // -----------------------------------------------

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

  stopRequested = false;


  // -----------------------------------------------
  // استقبال أجزاء الصوت
  // -----------------------------------------------

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


  // -----------------------------------------------
  // عند انتهاء التسجيل
  // -----------------------------------------------

  mediaRecorder.onstop =
    async () => {

      await finishRecording();

    };


  // -----------------------------------------------
  // عند حدوث خطأ
  // -----------------------------------------------

  mediaRecorder.onerror =
    (event) => {

      console.error(
        "MediaRecorder error:",
        event.error
      );

    };


  // -----------------------------------------------
  // بدء التسجيل
  // -----------------------------------------------

  mediaRecorder.start(100);


  isRecording = true;


  // لا يوجد وقت على الزر
  voiceButton.textContent =
    "🔴";


  voiceButton.classList.add(
    "recording"
  );


  console.log(
    "🎤 بدأ التسجيل"
  );

}


// ======================================================
// إيقاف التسجيل
// ======================================================

function stopRecording() {

  if (!isRecording) {

    return;

  }


  if (!mediaRecorder) {

    return;

  }


  if (
    mediaRecorder.state === "inactive"
  ) {

    return;

  }


  console.log(
    "⏹️ إيقاف التسجيل"
  );


  try {

    mediaRecorder.stop();

  }

  catch (error) {

    console.error(
      "Stop recording error:",
      error
    );

  }

}


// ======================================================
// إنهاء التسجيل
// ======================================================

async function finishRecording() {

  if (sendingVoice) {

    return;

  }


  sendingVoice = true;


  try {

    // -----------------------------------------------
    // أخذ نوع الملف قبل تنظيف recorder
    // -----------------------------------------------

    const mimeType =
      mediaRecorder &&
      mediaRecorder.mimeType
        ?
        mediaRecorder.mimeType
        :
        "audio/webm";


    // -----------------------------------------------
    // إيقاف الميكروفون
    // -----------------------------------------------

    stopMicrophone();


    // -----------------------------------------------
    // التأكد من وجود بيانات
    // -----------------------------------------------

    if (
      !audioChunks ||
      audioChunks.length === 0
    ) {

      throw new Error(
        "لم يتم تسجيل أي صوت"
      );

    }


    // -----------------------------------------------
    // إنشاء ملف الصوت
    // -----------------------------------------------

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


    // -----------------------------------------------
    // تحديد الامتداد
    // -----------------------------------------------

    let extension =
      "webm";


    if (
      mimeType.includes("mp4")
    ) {

      extension =
        "mp4";

    }


    // -----------------------------------------------
    // اسم ملف فريد
    // -----------------------------------------------

    const fileName =
      "voices/" +
      window.chatID +
      "/" +
      window.chatUser.uid +
      "_" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2) +
      "." +
      extension;


    console.log(
      "⬆️ رفع الصوت إلى Firebase Storage..."
    );


    // -----------------------------------------------
    // Firebase Storage
    // -----------------------------------------------

    const voiceRef =
      ref(
        window.storage,
        fileName
      );


    await uploadBytes(
      voiceRef,
      blob,
      {
        contentType:
          mimeType
      }
    );


    console.log(
      "✅ تم رفع الصوت"
    );


    // -----------------------------------------------
    // الحصول على الرابط الدائم
    // -----------------------------------------------

    const downloadURL =
      await getDownloadURL(
        voiceRef
      );


    console.log(
      "🔗 تم الحصول على رابط الصوت"
    );


    // -----------------------------------------------
    // حفظ الرسالة في Firestore
    // -----------------------------------------------

    await addDoc(

      collection(
        window.chatDB,
        "chats",
        window.chatID,
        "messages"
      ),

      {

        type:
          "voice",

        audio:
          downloadURL,

        senderId:
          window.chatUser.uid,

        receiverId:
          window.chatFriend.uid,

        createdAt:
          serverTimestamp()

      }

    );


    console.log(
      "✅ تم حفظ الرسالة في Firestore"
    );


    /*
      لا نضيف الرسالة يدويًا هنا.

      لأن chat.html عندك يستخدم:

      onSnapshot()

      لذلك Firestore سيضيف الرسالة
      تلقائيًا إلى الدردشة.
    */


  }

  catch (error) {

    console.error(
      "❌ Voice error:",
      error
    );


    alert(
      "حدث خطأ أثناء إرسال الرسالة الصوتية"
    );

  }

  finally {

    resetVoice();

    sendingVoice = false;

  }

}


// ======================================================
// إيقاف الميكروفون
// ======================================================

function stopMicrophone() {

  if (!audioStream) {

    return;

  }


  audioStream
    .getTracks()
    .forEach(
      (track) => {

        try {

          track.stop();

        }

        catch (error) {

          console.log(
            "Track stop error:",
            error
          );

        }

      }
    );


  audioStream = null;

}


// ======================================================
// إعادة زر الميكروفون
// ======================================================

function resetVoice() {

  stopMicrophone();


  mediaRecorder = null;

  audioChunks = [];

  isRecording = false;

  isStarting = false;

  stopRequested = false;


  voiceButton.textContent =
    "🎤";


  voiceButton.classList.remove(
    "recording"
  );

}


// ======================================================
// منع القائمة عند الضغط المطول
// ======================================================

voiceButton.addEventListener(
  "contextmenu",
  (event) => {

    event.preventDefault();

  }
);


console.log(
  "🎤 voice.js جاهز"
);

}
