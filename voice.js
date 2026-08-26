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


  // ====================================================
  // بدء التسجيل عند الضغط
  // ====================================================

  voiceButton.addEventListener("pointerdown", async (event) => {

    event.preventDefault();

    if (isRecording || isStarting || isSending) {
      return;
    }

    pointerId = event.pointerId;

    try {

      voiceButton.setPointerCapture(event.pointerId);

    } catch (error) {

      console.log("Pointer capture:", error);

    }

    isStarting = true;

    try {

      await startRecording();

    } catch (error) {

      console.error("❌ Start recording:", error);

      cleanup();

      if (error.name === "NotAllowedError") {

        alert("🎤 اسمح للموقع باستخدام الميكروفون أولًا.");

      } else if (error.name === "NotFoundError") {

        alert("❌ لم يتم العثور على ميكروفون.");

      } else {

        alert("❌ تعذر تشغيل التسجيل.");

      }

    }

    isStarting = false;

  });


  // ====================================================
  // رفع الإصبع = إيقاف وإرسال
  // ====================================================

  voiceButton.addEventListener("pointerup", (event) => {

    event.preventDefault();

    if (
      pointerId !== null &&
      event.pointerId !== pointerId
    ) {
      return;
    }

    pointerId = null;

    stopRecording();

  });


  // ====================================================
  // إلغاء اللمس
  // ====================================================

  voiceButton.addEventListener("pointercancel", (event) => {

    event.preventDefault();

    pointerId = null;

    stopRecording();

  });


  // ====================================================
  // إذا خرج الإصبع من الزر
  // ====================================================

  voiceButton.addEventListener("lostpointercapture", () => {

    if (isRecording) {
      stopRecording();
    }

  });


  // ====================================================
  // بدء التسجيل
  // ====================================================

  async function startRecording() {

    // -----------------------------------------------
    // التأكد من Firebase
    // -----------------------------------------------

    if (!window.storage) {
      throw new Error("Firebase Storage غير موجود");
    }

    if (!window.chatDB) {
      throw new Error("Firestore غير موجود");
    }

    if (!window.chatID) {
      throw new Error("chatID غير موجود");
    }

    if (!window.chatUser) {
      throw new Error("chatUser غير موجود");
    }

    if (!window.chatFriend) {
      throw new Error("chatFriend غير موجود");
    }


    // -----------------------------------------------
    // التأكد من دعم الميكروفون
    // -----------------------------------------------

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      throw new Error(
        "المتصفح لا يدعم الميكروفون"
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

    audioStream =
      await navigator.mediaDevices.getUserMedia({

        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }

      });


    // -----------------------------------------------
    // اختيار صيغة التسجيل
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

    } else {

      mediaRecorder =
        new MediaRecorder(
          audioStream
        );

    }


    audioChunks = [];


    // -----------------------------------------------
    // استقبال البيانات
    // -----------------------------------------------

    mediaRecorder.ondataavailable = (event) => {

      if (
        event.data &&
        event.data.size > 0
      ) {

        audioChunks.push(event.data);

      }

    };


    // -----------------------------------------------
    // عند توقف التسجيل
    // -----------------------------------------------

    mediaRecorder.onstop = async () => {

      await finishRecording();

    };


    // -----------------------------------------------
    // خطأ التسجيل
    // -----------------------------------------------

    mediaRecorder.onerror = (event) => {

      console.error(
        "❌ MediaRecorder:",
        event.error
      );

    };


    // -----------------------------------------------
    // بدء التسجيل
    // -----------------------------------------------

    mediaRecorder.start(100);

    isRecording = true;


    // -----------------------------------------------
    // شكل الزر أثناء التسجيل
    // -----------------------------------------------

    voiceButton.textContent = "🔴";

    voiceButton.classList.add("recording");


    console.log("🎤 بدأ التسجيل");

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


    console.log("⏹️ توقف التسجيل");


    try {

      mediaRecorder.stop();

    } catch (error) {

      console.error(
        "❌ Stop recording:",
        error
      );

      cleanup();

    }

  }


  // ====================================================
  // إنهاء التسجيل وإرساله
  // ====================================================

  async function finishRecording() {

    if (isSending) {
      return;
    }

    isSending = true;


    try {

      // ---------------------------------------------
      // أخذ نوع الملف
      // ---------------------------------------------

      const mimeType =
        mediaRecorder &&
        mediaRecorder.mimeType
          ? mediaRecorder.mimeType
          : "audio/webm";


      // ---------------------------------------------
      // إيقاف الميكروفون
      // ---------------------------------------------

      stopMicrophone();


      // ---------------------------------------------
      // التأكد من وجود تسجيل
      // ---------------------------------------------

      if (
        !audioChunks ||
        audioChunks.length === 0
      ) {

        throw new Error(
          "لم يتم تسجيل صوت"
        );

      }


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


      if (blob.size === 0) {

        throw new Error(
          "ملف الصوت فارغ"
        );

      }


      console.log(
        "🎵 حجم الملف:",
        blob.size
      );


      // ---------------------------------------------
      // تحديد الامتداد
      // ---------------------------------------------

      let extension = "webm";


      if (
        mimeType.includes("mp4")
      ) {

        extension = "mp4";

      }


      // ---------------------------------------------
      // اسم فريد للملف
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
        "⬆️ رفع الصوت..."
      );


      // ---------------------------------------------
      // Firebase Storage
      // ---------------------------------------------

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


      console.log(
        "✅ تم رفع الصوت"
      );


      // ---------------------------------------------
      // رابط الصوت
      // ---------------------------------------------

      const downloadURL =
        await getDownloadURL(
          voiceRef
        );


      console.log(
        "🔗 رابط الصوت جاهز"
      );


      // ---------------------------------------------
      // حفظ الرسالة
      // ---------------------------------------------

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
        "✅ تم حفظ التسجيل في المحادثة"
      );


      /*
        لا نضيف الرسالة يدويًا إلى الشاشة.

        onSnapshot الموجود في chat.html
        سيقرأ الرسالة من Firestore
        ويعرضها.

        لذلك عندما تخرج من المحادثة
        وترجع إليها، التسجيل يبقى موجودًا.
      */

    }

    catch (error) {

      console.error(
        "❌ Voice error:",
        error
      );


      alert(
        "❌ حدث خطأ أثناء إرسال التسجيل الصوتي."
      );

    }

    finally {

      cleanup();

      isSending = false;

    }

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
      .forEach((track) => {

        try {

          track.stop();

        } catch (error) {

          console.log(
            "Track stop:",
            error
          );

        }

      });


    audioStream = null;

  }


  // ====================================================
  // تنظيف الحالة
  // ====================================================

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


  // ====================================================
  // منع قائمة الضغط المطول
  // ====================================================

  voiceButton.addEventListener(
    "contextmenu",
    (event) => {

      event.preventDefault();

    }
  );


  console.log(
    "🎤 voice.js جاهز — وضع الضغط المطول"
  );

}
