export function decidirFlujoGoogle({
    linkedUser,
    emailUser,
    linkingUserId,
}) {
    if (linkingUserId) {
        return "link";
    }
    if (linkedUser) {
        return "login";
    }
    if (emailUser) {
        return "email-conflict";
    }
    return "create";
}

export function puedeVincularCuentaGoogle({
    linkedUser,
    emailUser,
    userId,
}) {
    return (
        (!linkedUser || String(linkedUser._id) === String(userId)) &&
        (!emailUser || String(emailUser._id) === String(userId))
    );
}
