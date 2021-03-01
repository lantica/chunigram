function timeout(ms) {
    return new Promise(r => setTimeout(r, ms));
}

(async () => {
    const axios = require('axios');
    const ppt = require('puppeteer');

    const browser = await ppt.launch();
    const chuNetPage = await browser.newPage();
    //await chuNetPage.setViewport({width:1920, height:1080}) // for capscreen
    await chuNetPage.goto("https://chunithm-net-eng.com/");

    await chuNetPage.waitForNavigation(); //wait for redirect to login page
    await chuNetPage.click(".c-button--openid--segaId");
    await chuNetPage.type("#sid", process.env["SEGAID"]);
    await chuNetPage.type("#password", process.env["SEGAPW"]);

    await Promise.all([
        chuNetPage.waitForNavigation(),
        chuNetPage.click("#btnSubmit"),
    ]);

    await chuNetPage.goto("https://chunithm-net-eng.com/mobile/record/musicGenre/");

    await Promise.all([
        chuNetPage.click(".btn_master"),
        chuNetPage.waitForNavigation(),
    ])

    const data = await chuNetPage.$$eval("form", form => form.map(e => {
        const html = e.innerHTML;
        if (!/class="play_musicdata_highscore"/.test(html)) return false;
        const name = html.match(/(?<=<div class="music_title">).+(?=<\/div>)/)[0];
        const score = html.match(/(?<=HIGH SCORE：<span class="text_b">).+(?=<\/span>)/)[0];
        const idx = html.match(/(?<=<input type="hidden" name="idx" value=").+(?=">)/)[0];
        return { name, score, idx }
    }));

    const score = data.filter(p => p);

    console.log(score);

    //await chuNetPage.screenshot({path: "cap.png"});
})()
