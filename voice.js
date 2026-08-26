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

const voiceButton = document.getElementById("voiceButton");

if (!voiceButton) {

  console.error("❌ voiceButton غير موجود");

} else {

  voiceButton.style.touchAction = "none";
  voiceButton.style.userSelect = "none";
  voiceButton.style.webkitUserSelect = "none";

  let mediaRecorder = null;
  let audioStream = null;
  let audioChunks = [];

  let isRecording = false;
  let isStarting = false;
  let isSending = false;

  let pointerId = null;


  // =====================================================
  // صندوق حالة صغير
  // =====================================================

  let debugBox = document.getElementById("voiceDebug");

  if (!debugBox) {

    debugBox = document.createElement("div");

    debugBox.id = "voiceDebug";

    debugBox.style.position = "fixed";
    debugBox.style.bottom = "70px";
    debugBox.style.left = "10px";
    debugBox.style.right = "10px";
    debugBox.style.padding = "8px";
    debugBox.style.background = "rgba(0,0,0,.85)";
    debugBox.style.color = "#00e889";
    debugBox.style.fontSize = "12px";
    debugBox.style.textAlign = "center";
    debugBox.style.borderRadius = "10px";
    debugBox.style.zIndex = "9999";
    debugBox.style.display = "none";

    document.body.appendChild(debugBox);

  }


  function debug(message) {

    console.log("🎤 VOICE:", message);

    debugBox.textContent = message;
    debugBox.style.display = "block";

  }


  // =====================================================
  // الضغط على الميكروفون
  // =====================================================

  voiceButton.addEventListener("pointerdown", async (event) => {

    event.preventDefault();

    if (isRecording || isStarting || isSending) {
      return;
    }

    pointerId = event.pointerId;

    try {

      voiceButton.setPointerCapture(event.pointerId);

    } catch (error) {

      console.log(error);

    }

    isStarting = true;

    debug("🟡 جاري تشغيل الميكروفون...");

    try {

      await startRecording();

    } catch (error) {

      console.error(error);

      debug(
        "❌ فشل تشغيل الميكروفون: " +
        error.message
      );

      cleanup();

      if (error.name === "NotAllowedError") {

        alert("🎤 اسمح للموقع باستخدام الميكروفون.");

      } else {

        alert(
          "❌ تعذر تشغيل الميكروفون: " +
          error.message
        );

      }

    }

    isStarting = false;

  });


  // =====================================================
  // رفع الإصبع
  // =====================================================

  voiceButton.addEventListener("pointerup", (event) => {

    event.preventDefault();

    if (
      pointerId !== null &&
      event.pointerId !== pointerId
    ) {
      return;
    }

    pointerId = null;

    debug("🟠 تم رفع الإصبع — إيقاف التسجيل...");

    stopRecording();

  });


  // =====================================================
  // إلغاء اللمس
  // =====================================================

  voiceButton.addEventListener("pointercancel", (event) => {

    event.preventDefault();

    pointerId = null;

    debug("🟠 تم إلغاء اللمس");

    stopRecording();

  });


  // =====================================================
  // منع القائمة
  // =====================================================

  voiceButton.addEventListener("contextmenu", (event) => {

    event.preventDefault();

  });


  // =====================================================
  // بدء التسجيل
  // =====================================================

  async function startRecording() {

    // -----------------------------------------------
    // فحص Firebase
    // -----------------------------------------------

    debug("🔎 فحص Firebase...");

    if (!window.storage) {
      throw new Error("window.storage غير موجود");
    }

    if (!window.chatDB) {
      throw new Error("window.chatDB غير موجود");
    }

    if (!window.chatID) {
      throw new Error("window.chatID غير موجود");
    }

    if (!window.chatUser) {
      throw new Error("window.chatUser غير موجود");
    }

    if (!window.chatFriend) {
      throw new Error("window.chatFriend غير موجود");
    }


    debug("🟢 Firebase جاهز");


    // -----------------------------------------------
    // فحص الميكروفون
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

    debug("🎤 طلب إذن الميكروفون...");

    audioStream =
      await navigator.mediaDevices.getUserMedia({

        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }

      });


    debug("🟢 الميكروفون يعمل");


    // -----------------------------------------------
    // اختيار الصيغة
    // -----------------------------------------------

    let mimeType = "";

    const formats = [

      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4"

    ];


    for (const format of formats) {

      if (
        MediaRecorder.isTypeSupported(format)
      ) {

        mimeType = format;

        break;

      }

    }


    console.log(
      "🎵 MIME:",
      mimeType
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

    } else {

      mediaRecorder =
        new MediaRecorder(audioStream);

    }


    audioChunks = [];


    // -----------------------------------------------
    // وصول البيانات
    // -----------------------------------------------

    mediaRecorder.ondataavailable = (event) => {

      console.log(
        "📦 dataavailable:",
        event.data.size
      );

      if (
        event.data &&
        event.data.size > 0
      ) {

        audioChunks.push(event.data);

      }

    };


    // -----------------------------------------------
    // توقف التسجيل
    // -----------------------------------------------

    mediaRecorder.onstop = async () => {

      debug(
        "🟢 MediaRecorder توقف — تجهيز الملف..."
      );

      await finishRecording();

    };


    // -----------------------------------------------
    // خطأ
    // -----------------------------------------------

    mediaRecorder.onerror = (event) => {

      console.error(
        "❌ MediaRecorder error:",
        event.error
      );

      debug(
        "❌ خطأ MediaRecorder"
      );

    };


    // -----------------------------------------------
    // بدء
    // -----------------------------------------------

    mediaRecorder.start(100);

    isRecording = true;


    voiceButton.textContent = "🔴";

    voiceButton.classList.add("recording");


    debug("🔴 جاري التسجيل... ارفع إصبعك للإرسال");

  }


  // =====================================================
  // إيقاف التسجيل
  // =====================================================

  function stopRecording() {

    if (!isRecording) {

      console.log(
        "ℹ️ stopRecording: لا يوجد تسجيل"
      );

      return;

    }


    if (!mediaRecorder) {

      debug("❌ MediaRecorder غير موجود");

      return;

    }


    if (
      mediaRecorder.state === "inactive"
    ) {

      debug("⚠️ التسجيل متوقف أصلًا");

      return;

    }


    debug("⏹️ إرسال أمر إيقاف التسجيل...");


    try {

      mediaRecorder.stop();

    } catch (error) {

      console.error(error);

      debug(
        "❌ فشل إيقاف التسجيل: " +
        error.message
      );

      cleanup();

    }

  }


  // =====================================================
  // إنهاء التسجيل
  // =====================================================

  async function finishRecording() {

    if (isSending) {
      return;
    }

    isSending = true;


    try {

      debug("📦 تجهيز ملف الصوت...");


      // ---------------------------------------------
      // نوع الملف
      // ---------------------------------------------

      const mimeType =
        mediaRecorder &&
        mediaRecorder.mimeType
          ?
          mediaRecorder.mimeType
          :
          "audio/webm";


      console.log(
        "MIME:",
        mimeType
      );


      // ---------------------------------------------
      // إيقاف الميكروفون
      // ---------------------------------------------

      stopMicrophone();


      // ---------------------------------------------
      // فحص البيانات
      // ---------------------------------------------

      console.log(
        "عدد القطع:",
        audioChunks.length
      );


      if (
        audioChunks.length === 0
      ) {

        throw new Error(
          "لم تصل أي بيانات صوت"
        );

      }


      // ---------------------------------------------
      // إنشاء الملف
      // ---------------------------------------------

      const blob =
        new Blob(
          audioChunks,
          {
            type: mimeType
          }
        );


      console.log(
        "حجم الملف:",
        blob.size
      );


      if (blob.size === 0) {

        throw new Error(
          "ملف الصوت حجمه صفر"
        );

      }


      debug(
        "🟢 تم إنشاء الملف — الحجم: " +
        Math.round(blob.size / 1024) +
        " KB"
      );


      // ---------------------------------------------
      // الامتداد
      // ---------------------------------------------

      let extension = "webm";


      if (
        mimeType.includes("mp4")
      ) {

        extension = "mp4";

      }


      // ---------------------------------------------
      // اسم الملف
      // ---------------------------------------------

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
          .substring(2, 10) +

        "." +

        extension;


      console.log(
        "اسم الملف:",
        fileName
      );


      // ---------------------------------------------
      // Storage reference
      // ---------------------------------------------

      debug("⬆️ جاري رفع الصوت إلى Firebase...");


      const voiceRef =
        ref(
          window.storage,
          fileName
        );


      await uploadBytes(

        voiceRef,

        blob,

        {
          contentType: mimeType
        }

      );


      debug("🟢 تم رفع الصوت بنجاح");


      // ---------------------------------------------
      // الرابط
      // ---------------------------------------------

      const downloadURL =
        await getDownloadURL(
          voiceRef
        );


      console.log(
        "URL:",
        downloadURL
      );


      debug("🔗 تم الحصول على رابط الصوت");


      // ---------------------------------------------
      // Firestore
      // ---------------------------------------------

      debug(
        "💾 جاري حفظ رسالة الصوت..."
      );


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


      debug(
        "✅ تم إرسال رسالة صوتية بنجاح"
      );


      setTimeout(() => {

        debugBox.style.display = "none";

      }, 2000);


    }

    catch (error) {

      console.error(
        "❌ VOICE ERROR:",
        error
      );


      debug(
        "❌ توقف هنا: " +
        error.message
      );


      alert(
        "❌ خطأ في إرسال الصوت:\n\n" +
        error.message
      );

    }

    finally {

      cleanup();

      isSending = false;

    }

  }


  // =====================================================
  // إيقاف الميكروفون
  // =====================================================

  function stopMicrophone() {

    if (!audioStream) {
      return;
    }


    audioStream
      .getTracks()
      .forEach((track) => {

        try {

          track.stop();

        } catch (error) {

          console.log(error);

        }

      });


    audioStream = null;

  }


  // =====================================================
  // تنظيف
  // =====================================================

  function cleanup() {

    stopMicrophone();


    mediaRecorder = null;

    audioChunks = [];

    isRecording = false;

    isStarting = false;

    pointerId = null;


    voiceButton.textContent = "🎤";

    voiceButton.classList.remove(
      "recording"
    );

  }


  console.log(
    "🎤 voice.js diagnostic version loaded"
  );

}
