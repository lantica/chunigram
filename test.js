const ppt = require("puppeteer");
const linear = require("everpolate").linear;
const revLevelLookup = {
    "basic": "BAS",
    "advanced": "ADV",
    "expert": "EXP",
    "master": "MAS"
};
const levelLookup = {
    BAS: "basic",
    ADV: "advanced",
    EXP: "expert",
    MAS: "master"
};
const main = async () => {
    const Ioredis = require("ioredis");
    const redisInstance = new Ioredis('redis://:p80f0adced22e6c5fc7caeb9ed57170e654a36a8b522394e34c1217a2766c7faf@ec2-52-54-116-132.compute-1.amazonaws.com:6929', { enableAutoPipelining: true });
    const ssid = process.argv[2];

    const calculateRating = ({ name, score, level }) => {
        return new Promise(async rsov => {
            const diffConst = parseFloat(await redisInstance.hget(name, level));
            const rating = Math.max(
                linear(score,
                    [0, 500000, 800000, 900000, 925000, 975000, 1000000, 1005000, 1007500, 1010000],
                    [0, 0, (diffConst - 5) / 2, diffConst - 5, diffConst - 3, diffConst, diffConst + 1, diffConst + 1.5, diffConst + 2, diffConst + 2])[0],
                0
            );
            rsov({ level, name, score, rating, diffConst })
        })
    };

    const browser = await ppt.launch({
        executablePath: "/opt/homebrew/bin/chromium"
    });
    const loginPage = await browser.newPage();
    const initResp = await loginPage.goto(`https://chunithm-net-eng.com/mobile/?ssid=${ssid}`, { waitUntil: "networkidle0" });
    if (initResp.status() === 503) throw new Error("under maintainance");

    //calculate rating for recent 10 songs
    await loginPage.goto("https://chunithm-net-eng.com/mobile/record/playlog", { waitUntil: "domcontentloaded" });
    const recent30Songs = (await Promise.all(
        (await loginPage.$$eval("div.play_data_side", (data, revLevelLookup) => data.slice(0, 30).map((div) => {

            const level = div.querySelector("div.play_track_block").querySelector(".play_track_result").firstElementChild.getAttribute("src").match(
                /(?<=https:\/\/chunithm-net-eng.com\/mobile\/images\/icon_text_)(.+?)(?=.png)/
            )[0];
            const data = div.querySelector("div.play_musicdata_block");
            const name = data.firstElementChild.innerText;
            const score = data.querySelector(".play_musicdata_score").firstElementChild.innerText.substr(6).replace(/,/g, "");
            return {
                level: revLevelLookup[level],
                name,
                score,
            }
        }), revLevelLookup)).map(calculateRating)
    )).sort((a, b) => {
        return b.rating - a.rating
    });


    async function getAllRatingForLevel(level) {
        const ratingPage = await browser.newPage();
        await ratingPage.goto("https://chunithm-net-eng.com/mobile/record/musicGenre/", { waitUntil: "domcontentloaded" });
        await ratingPage.click(`.btn_${levelLookup[level]}`);
        await ratingPage.waitForTimeout(2000); //can't use wait for selector as the div in button may not be loaded
        const playedSongs = await ratingPage.$$eval("div.musiclist_box > div.play_musicdata_highscore", (playedSongs, level) => playedSongs.map(song => {
            return {
                level,
                name: song.previousElementSibling.innerText,
                score: song.querySelector(".text_b").innerText.replace(/,/g, ""),
            }
        }), level)
        ratingPage.close();
        return playedSongs.map(calculateRating);
        // const html = await resp.text(); //use selector to fix escape issue?
        // ratingPage.close();

        // const scores = html
        //     .match(formRegex)
        //     .reduce((acc, cur) => {
        //         if (!playedRegex.test(cur)) return acc;
        //         const name = cur.match(nameRegex)[0].replace(nameEscapeRegex, "'");
        //         const score = parseInt(cur.match(scoreRegex)[0].replace(commaRegex, ""));
        //         return (acc.push({ name, score, level }), acc);
        //     }, []);

        // const ratings = await Promise.all(scores.map(calculateRating));
    }

    const allLevelSongs = [];
    for (let diff of ["MAS", "EXP", /*"ADV", "BAS"*/]) {
        const ratings = await getAllRatingForLevel(diff);
        allLevelSongs.push(...(await Promise.all(ratings)));
    }
    const allLevelSortedRatings = allLevelSongs.filter(p => p.diffConst).sort((a, b) => {
        return b.rating - a.rating
    });

    const best30Songs = allLevelSortedRatings.slice(0, 30);
    const alt10Songs = allLevelSortedRatings.slice(30, 40);

    const best30Rating = best30Songs.reduce((acc, cur) => acc + cur.rating, 0) / 30;
    const recent10Rating = recent30Songs.slice(0, 10).reduce((acc, cur) => acc + cur.rating, 0) / 10;
    const estimatedRating = (best30Rating * 3 + recent10Rating) / 4;

    console.log(best30Songs);
    console.log(recent30Songs.slice(0, 10));
    console.log("estimate rating: ", best30Rating, recent10Rating, estimatedRating);
    await browser.close();

    //await fs.writeFile("result.json", JSON.stringify(allLevelSortedRatings));
};

main()
