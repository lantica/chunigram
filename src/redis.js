const { default: axios } = require("axios");
const qs = require("querystring");

async function initRedis(redisInstance) {
    await redisInstance.flushdb();

    const musicData = (await axios.get(`https://api.chunirec.net/1.3/music/showall.json?${qs.encode({ token: process.env["CHUNIREC_TOKEN"] })}`))?.data;

    const musicEntries = musicData.filter(data => data.data?.["MAS"]).map(data => [data.meta.title, {
        BAS: data.data.BAS.const,
        ADV: data.data.ADV.const,
        EXP: data.data.EXP.const,
        MAS: data.data.MAS.const,
    }])

    console.log("going to write const");
    await Promise.all(
        musicEntries.map(song => {
            redisInstance.hmset(song[0], song[1]);
        })
    );
    await redisInstance.set("ready", "ready");
    console.log("music db inited");
}

exports.initRedis = initRedis;

