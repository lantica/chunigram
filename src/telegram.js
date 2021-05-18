const axios = require("axios");
const tgAPI = axios.create({ baseURL: `https://api.telegram.org/bot${process.env["TG_TOKEN"]}/` });

function sendMessage(chat_id, text) {
    return tgAPI.post("sendMessage", { chat_id, text });
}

function sendSticker(chat_id, sticker) {
    return tgAPI.post("sendSticker", {chat_id, sticker});
}

async function setWebhook() {
    const resp = await tgAPI.post("setWebhook", {
        url: `https://chunigram.herokuapp.com/${process.env["TG_TOKEN"]}`
    });
    if (resp.data?.ok !== true) throw new Error(resp.data?.description);
}

exports.sendMessage = sendMessage;
exports.setWebhook = setWebhook;
exports.sendSticker = sendSticker;