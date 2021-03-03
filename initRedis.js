(async () => {
    const { promises: fs } = require("fs");
    const Ioredis = require("ioredis");
    const redisInstance = new Ioredis({enableAutoPipelining: true});
    await new Promise(rsov => {
        redisInstance.once('connect', () => {
            console.log('redis connected');
            rsov();
        })
    });

    const musicData = (JSON.parse(await fs.readFile("musicData.json"))).reduce((acc, { meta, data }) => {
        if (data?.["MAS"]) {
            acc.BAS[meta.title] = data.BAS.const;
            acc.ADV[meta.title] = data.ADV.const;
            acc.EXP[meta.title] = data.EXP.const;
            acc.MAS[meta.title] = data.MAS.const;
            return acc;
        } else return acc;
    }, {
        BAS: {},
        ADV: {},
        EXP: {},
        MAS: {},
    });
    //console.log(musicData);
    
    console.log('going to init music database');
    redisInstance.hset("BAS", musicData.BAS);
    redisInstance.hset("ADV", musicData.ADV);
    redisInstance.hset("EXP", musicData.EXP);
    redisInstance.hset("MAS", musicData.MAS);
    console.log("db inited")

})()
