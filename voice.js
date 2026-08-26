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


// ======================================================
// المتغيرات
// ======================================================

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];

let isRecording = false;
let isStarting = false;
let stopRequested = false;


// ======================================================
// بدء التسجيل عند الضغط
// ======================================================

voiceButton.addEventListener(
  "pointerdown",
  async (event) => {

    event.preventDefault();

    // منع بدء تسجيل ثاني
    if (isRecording || isStarting) {
      return;
    }

    isStarting = true;
    stopRequested = false;


    // تثبيت الإصبع على الزر
    try {

      voiceButton.setPointerCapture(
        event.pointerId
      );

    } catch (error) {

      console.log(
        "Pointer capture:",
        error
      );

    }


    try {

      await startRecording();

    } catch (error) {

      console.error(
        "Microphone start error:",
        error
      );

      stopMicrophone();

      resetVoice();

      alert(
        "لم يتم السماح بالميكروفون"
      );

    }


    isStarting = false;


    // إذا رفع المستخدم إصبعه
    // أثناء انتظار تشغيل الميكروفون
    if (
      stopRequested &&
      isRecording
    ) {

      stopRecording();

    }

  }
);


// ======================================================
// رفع الإصبع = إنهاء التسجيل
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
  () => {

    stopRequested = true;

    stopRecording();

  }
);


// ======================================================
// فقدان التحكم بالمؤشر
// ======================================================

voiceButton.addEventListener(
  "lostpointercapture",
  () => {

    if (isRecording) {

      stopRequested = true;

      stopRecording();

    }

  }
);


// ======================================================
// بدء التسجيل
// ======================================================

async function startRecording() {

  // --------------------------------------------
  // التأكد من أن بيانات الدردشة جاهزة
  // --------------------------------------------

  if (
    !window.storage ||
    !window.chatDB ||
    !window.chatID ||
    !window.chatUser ||
    !window.chatFriend
  ) {

    throw new Error(
      "Chat/Firebase variables are missing"
    );

  }


  // --------------------------------------------
  // التأكد من دعم الميكروفون
  // --------------------------------------------

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "Microphone is not supported"
    );

  }


  // --------------------------------------------
  // طلب الميكروفون
  // --------------------------------------------

  audioStream =
    await navigator.mediaDevices.getUserMedia({
      audio: true
    });


  // --------------------------------------------
  // اختيار أفضل صيغة
  // --------------------------------------------

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


  // --------------------------------------------
  // إنشاء MediaRecorder
  // --------------------------------------------

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


  // تنظيف التسجيل السابق
  audioChunks = [];


  // --------------------------------------------
  // استقبال أجزاء الصوت
  // --------------------------------------------

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


  // --------------------------------------------
  // عند إيقاف التسجيل
  // --------------------------------------------

  mediaRecorder.onstop =
    async () => {

      await finishRecording();

    };


  // --------------------------------------------
  // بدء التسجيل
  // --------------------------------------------

  mediaRecorder.start();


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


  if (
    !mediaRecorder
  ) {
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


  // مهم:
  // لا نوقف الـ stream هنا.
  // ننتظر onstop حتى تصل آخر قطعة صوت.
  mediaRecorder.stop();

}


// ======================================================
// إنهاء التسجيل
// رفعه إلى Storage
// حفظه في Firestore
// ======================================================

async function finishRecording() {

  try {

    // --------------------------------------------
    // التأكد من وجود بيانات صوت
    // --------------------------------------------

    if (
      !audioChunks ||
      audioChunks.length === 0
    ) {

      throw new Error(
        "No audio data recorded"
      );

    }


    // --------------------------------------------
    // نوع الصوت
    // --------------------------------------------

    const mimeType =
      mediaRecorder &&
      mediaRecorder.mimeType
        ? mediaRecorder.mimeType
        : "audio/webm";


    // --------------------------------------------
    // إنشاء Blob
    // --------------------------------------------

    const blob =
      new Blob(
        audioChunks,
        {
          type: mimeType
        }
      );


    console.log(
      "🎵 Audio size:",
      blob.size
    );


    if (blob.size === 0) {

      throw new Error(
        "Audio blob is empty"
      );

    }


    // --------------------------------------------
    // اسم فريد للملف
    // --------------------------------------------

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
      ".webm";


    console.log(
      "⬆️ رفع الصوت إلى Firebase Storage..."
    );


    // --------------------------------------------
    // رفع الصوت
    // --------------------------------------------

    const voiceRef =
      ref(
        window.storage,
        fileName
      );


    await uploadBytes(
      voiceRef,
      blob,
      {
        contentType: "audio/webm"
      }
    );


    // --------------------------------------------
    // الحصول على رابط دائم
    // --------------------------------------------

    const downloadURL =
      await getDownloadURL(
        voiceRef
      );


    console.log(
      "✅ تم رفع الصوت"
    );


    // --------------------------------------------
    // حفظ الرسالة في Firestore
    // --------------------------------------------

    await addDoc(

      collection(
        window.chatDB,
        "chats",
        window.chatID,
        "messages"
      ),

      {

        type: "voice",

        audio: downloadURL,

        senderId:
          window.chatUser.uid,

        receiverId:
          window.chatFriend.uid,

        createdAt:
          serverTimestamp()

      }

    );


    console.log(
      "✅ تم حفظ الرسالة الصوتية في Firestore"
    );


  }

  catch (error) {

    console.error(
      "❌ Voice send error:",
      error
    );


    alert(
      "حدث خطأ أثناء إرسال الرسالة الصوتية"
    );

  }

  finally {

    // ------------------------------------------
    // إيقاف الميكروفون بعد انتهاء التسجيل
    // ------------------------------------------

    stopMicrophone();

    resetVoice();

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

        track.stop();

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
