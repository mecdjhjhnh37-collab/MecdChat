// ======================================================
// voice.js
// تسجيل صوت مثل واتساب
// يبدأ عند الضغط
// يتوقف عند رفع الإصبع
// يحفظ الصوت داخل Firestore فقط
// ======================================================

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const voiceButton =
  document.getElementById("voiceButton");


if (!voiceButton) {

  console.error("❌ voiceButton غير موجود");

} else {


  // ====================================================
  // المتغيرات
  // ====================================================

  let mediaRecorder = null;

  let audioStream = null;

  let audioChunks = [];

  let isRecording = false;

  let isStarting = false;

  let stopRequested = false;

  let sendingVoice = false;


  voiceButton.style.touchAction = "none";
  voiceButton.style.userSelect = "none";


  // ====================================================
  // الضغط على زر الميكروفون
  // ====================================================

  voiceButton.addEventListener(
    "pointerdown",
    async (event) => {

      event.preventDefault();

      if (
        event.pointerId !== undefined &&
        voiceButton.setPointerCapture
      ) {

        try {

          voiceButton.setPointerCapture(
            event.pointerId
          );

        } catch (e) {}

      }


      // لا تسجل مرتين
      if (
        isRecording ||
        isStarting ||
        sendingVoice
      ) {

        return;

      }


      console.log("🎤 ضغط على الميكروفون");


      isStarting = true;

      stopRequested = false;


      try {

        await startRecording();

      }

      catch (error) {

        console.error(
          "❌ خطأ تشغيل التسجيل:",
          error
        );

        stopMicrophone();

        resetVoice();


        if (
          error.name === "NotAllowedError"
        ) {

          alert(
            "⚠️ اسمح للموقع باستخدام الميكروفون"
          );

        }

        else {

          alert(
            "❌ تعذر تشغيل الميكروفون"
          );

        }

      }

      finally {

        isStarting = false;

      }


      // ================================================
      // إذا رفع إصبعه أثناء انتظار تشغيل الميكروفون
      // ================================================

      if (
        stopRequested &&
        isRecording
      ) {

        console.log(
          "⏹️ تم طلب الإيقاف أثناء بدء التسجيل"
        );

        stopRecording();

      }

    }
  );


  // ====================================================
  // رفع الإصبع
  // ====================================================

  voiceButton.addEventListener(
    "pointerup",
    (event) => {

      event.preventDefault();

      console.log("☝️ رفع الإصبع");


      stopRequested = true;


      if (isRecording) {

        stopRecording();

      }

    }
  );


  // ====================================================
  // إلغاء اللمس
  // ====================================================

  voiceButton.addEventListener(
    "pointercancel",
    (event) => {

      event.preventDefault();

      stopRequested = true;

      stopRecording();

    }
  );


  // ====================================================
  // بدء التسجيل
  // ====================================================

  async function startRecording() {


    // -----------------------------------------------
    // التأكد من Firebase
    // -----------------------------------------------

    if (
      !window.chatDB ||
      !window.chatID ||
      !window.chatUser ||
      !window.chatFriend
    ) {

      throw new Error(
        "Firebase chat variables missing"
      );

    }


    // -----------------------------------------------
    // دعم الميكروفون
    // -----------------------------------------------

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      throw new Error(
        "getUserMedia غير مدعوم"
      );

    }


    if (
      typeof MediaRecorder === "undefined"
    ) {

      throw new Error(
        "MediaRecorder غير مدعوم"
      );

    }


    // -----------------------------------------------
    // تشغيل الميكروفون
    // -----------------------------------------------

    console.log(
      "🎤 طلب إذن الميكروفون..."
    );


    audioStream =
      await navigator.mediaDevices.getUserMedia({

        audio: {

          echoCancellation: true,

          noiseSuppression: true,

          autoGainControl: true

        }

      });


    console.log(
      "✅ الميكروفون اشتغل"
    );


    // -----------------------------------------------
    // اختيار نوع الصوت
    // -----------------------------------------------

    let mimeType = "";


    const types = [

      "audio/webm;codecs=opus",

      "audio/webm",

      "audio/mp4"

    ];


    for (
      const type of types
    ) {

      if (
        MediaRecorder.isTypeSupported(type)
      ) {

        mimeType = type;

        break;

      }

    }


    console.log(
      "🎵 نوع الصوت:",
      mimeType || "default"
    );


    // -----------------------------------------------
    // إنشاء Recorder
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


    // مهم:
    // لا نضع stopRequested = false هنا
    // لأن المستخدم ممكن يكون رفع إصبعه
    // أثناء انتظار getUserMedia


    // -----------------------------------------------
    // استقبال البيانات
    // -----------------------------------------------

    mediaRecorder.ondataavailable =
      (event) => {

        console.log(
          "📦 data:",
          event.data?.size || 0
        );


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
    // انتهاء التسجيل
    // -----------------------------------------------

    mediaRecorder.onstop =
      async () => {

        console.log(
          "⏹️ MediaRecorder توقف"
        );


        await finishRecording();

      };


    // -----------------------------------------------
    // خطأ
    // -----------------------------------------------

    mediaRecorder.onerror =
      (event) => {

        console.error(
          "❌ MediaRecorder error:",
          event.error
        );

      };


    // -----------------------------------------------
    // بدء التسجيل
    // -----------------------------------------------

    mediaRecorder.start();


    isRecording = true;


    // تغيير شكل الزر
    voiceButton.textContent =
      "🔴";


    voiceButton.classList.add(
      "recording"
    );


    console.log(
      "🔴 بدأ التسجيل"
    );

  }


  // ====================================================
  // إيقاف التسجيل
  // ====================================================

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
      "⏹️ إيقاف التسجيل..."
    );


    try {

      mediaRecorder.stop();

    }

    catch (error) {

      console.error(
        "❌ Stop error:",
        error
      );

    }

  }


  // ====================================================
  // إنهاء التسجيل
  // ====================================================

  async function finishRecording() {


    if (sendingVoice) {

      return;

    }


    sendingVoice = true;


    try {


      // ---------------------------------------------
      // إيقاف الميكروفون
      // ---------------------------------------------

      stopMicrophone();


      // ---------------------------------------------
      // التأكد من وجود صوت
      // ---------------------------------------------

      if (
        audioChunks.length === 0
      ) {

        throw new Error(
          "لم يتم تسجيل صوت"
        );

      }


      // ---------------------------------------------
      // تحديد MIME
      // ---------------------------------------------

      const mimeType =
        mediaRecorder?.mimeType ||
        "audio/webm";


      // ---------------------------------------------
      // إنشاء Blob
      // ---------------------------------------------

      const blob =
        new Blob(
          audioChunks,
          {
            type: mimeType
          }
        );


      console.log(
        "🎵 حجم الصوت:",
        blob.size,
        "bytes"
      );


      if (
        blob.size === 0
      ) {

        throw new Error(
          "ملف الصوت فارغ"
        );

      }


      // ---------------------------------------------
      // حماية من تجاوز حجم Firestore
      // ---------------------------------------------

      if (
        blob.size > 700000
      ) {

        alert(
          "⚠️ التسجيل طويل جدًا. سجل مقطعًا أقصر."
        );

        return;

      }


      // ---------------------------------------------
      // تحويل الصوت إلى Base64
      // ---------------------------------------------

      const base64 =
        await blobToBase64(blob);


      console.log(
        "✅ تم تحويل الصوت"
      );


      // ---------------------------------------------
      // حفظ داخل Firestore
      // ---------------------------------------------

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
            base64,

          mimeType:
            mimeType,

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


  // ====================================================
  // تحويل Blob إلى Base64
  // ====================================================

  function blobToBase64(blob) {

    return new Promise(
      (resolve, reject) => {

        const reader =
          new FileReader();


        reader.onloadend =
          () => {

            resolve(
              reader.result
            );

          };


        reader.onerror =
          reject;


        reader.readAsDataURL(
          blob
        );

      }
    );

  }


  // ====================================================
  // إيقاف الميكروفون
  // ====================================================

  function stopMicrophone() {


    if (!audioStream) {

      return;

    }


    audioStream
      .getTracks()
      .forEach(
        track => {

          try {

            track.stop();

          }

          catch (e) {}

        }
      );


    audioStream = null;

  }


  // ====================================================
  // إعادة الزر
  // ====================================================

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


    console.log(
      "🎤 جاهز للتسجيل من جديد"
    );

  }


  // ====================================================
  // منع القائمة عند الضغط المطول
  // ====================================================

  voiceButton.addEventListener(
    "contextmenu",
    event => {

      event.preventDefault();

    }
  );


  console.log(
    "🎤 voice.js جاهز"
  );

}
