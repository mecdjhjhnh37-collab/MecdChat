/*
========================================
Mecd Chat - Call System
========================================
*/

export function startCall({
    friendId,
    friendName,
    friendPhoto
}) {

    if (!friendId) {
        alert("لم يتم تحديد الصديق");
        return;
    }

    const params = new URLSearchParams();

    params.set("friend", friendId);
    params.set("name", friendName || "مستخدم Mecd");

    if (friendPhoto) {
        params.set("photo", friendPhoto);
    }

    params.set("mode", "outgoing");

    window.location.href =
        "call.html?" + params.toString();
}
