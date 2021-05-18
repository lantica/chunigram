const ppt = require("puppeteer");
const linear = require("everpolate").linear;
const levelLookup = {
    BAS: "basic",
    ADV: "advanced",
    EXP: "expert",
    MAS: "master"
};

async function parse(ssid, redisInstance) {
    try {
        async function getAllRatingForLevel(level, browser) {
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
            const ratingPage = await browser.newPage();
            await ratingPage.goto("https://chunithm-net-eng.com/mobile/record/musicGenre/", { waitUntil: "domcontentloaded" });
            await ratingPage.click(`.btn_${levelLookup[level]}`);
            await ratingPage.waitForTimeout(2000);
            const playedSongs = await ratingPage.$$eval("div.musiclist_box > div.play_musicdata_highscore", (playedSongs, level) => playedSongs.map(song => {
                return {
                    level,
                    name: song.previousElementSibling.innerText,
                    score: song.querySelector(".text_b").innerText.replace(/,/g, ""),
                };
            }), level);
            ratingPage.close();
            return Promise.all(playedSongs.map(calculateRating));
        }

        const browser = await ppt.launch({
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
            ]
        });
        const loginPage = await browser.newPage();
        const initResp = await loginPage.goto(`https://chunithm-net-eng.com/mobile/?ssid=${ssid}`, { waitUntil: "networkidle0" });
        if (initResp.status() === 503) throw new Error("under maintainance");

        const [currRating, maxRating] = await loginPage.$eval(".player_rating", rating => {
            const currRegex = /(?<=RATING : ).*?(?= \/ \(MAX )/;
            const maxRegex = /(?<=MAX ).*?(?=\))/;
            const text = rating.innerText;
            return [parseFloat(text.match(currRegex)[0]), parseFloat(text.match(maxRegex)[0])];
        });

        const allLevelSongs = (await Promise.all(["MAS", "EXP", "ADV", "BAS"].map(diff => {
            return getAllRatingForLevel(diff, browser);
        }))).flat();
        const allLevelSortedRatings = allLevelSongs.filter(p => p.diffConst).sort((a, b) => {
            return b.rating - a.rating
        });
        const best30Songs = allLevelSortedRatings.splice(0, 30);
        const best30Rating = best30Songs.reduce((acc, cur) => acc + cur.rating, 0) / 30;
        const alt10Songs = allLevelSortedRatings.reduce((acc, cur) => {
            return (acc.length < 10 && cur.diffConst + 2 > best30Rating)
                ? acc.concat([cur])
                : acc;
        }, []);
        browser.close();
        return { best30Songs, best30Rating, currRating, maxRating, alt10Songs };
    } catch (e) {
        console.warn(e);
        throw new Error(e);
    }
};
exports.parse = parse;