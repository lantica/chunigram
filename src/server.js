(async () => {
    const { sendMessage, setWebhook, sendSticker } = require("./telegram");
    const server = require("server");
    const { get, post, error } = server.router;
    const { send, json, status } = server.reply;
    const { initRedis } = require("./redis");
    const { setTimeout } = require("timers/promises");
    const EE = require("events");
    const tgEmitter = new EE();
    const pg = require("pg-promise")();
    const db = pg({
        connectionString: process.env["DATABASE_URL"],
        ssl: { rejectUnauthorized: false },
    });

    //check redis inited and init redis queue
    const Ioredis = require("ioredis");
    const redisInstance = new Ioredis(process.env["REDIS_URL"], { enableAutoPipelining: true, connectTimeout: 10000 });
    while (await redisInstance.get("ready") !== "ready") {
        console.warn("redis not yet inited");
        await initRedis(redisInstance).catch(e => console.warn(e));
        await setTimeout(10000);
    }
    console.log("redis ready!");

    await db.connect();
    try {
        await db.one(`select * from information_schema.tables where "table_name" = 'user'`);
        console.log("Postgre connected");
    } catch (e) {
        const initQuery = new pg.QueryFile("../sql/init.sql");
        await db.any(initQuery);
        console.log("Postgre init success.");
    }

    const UpdateQueue = require("./updateQueue");
    const updateQueue = new UpdateQueue(process.env["REDIS_URL"], tgEmitter, redisInstance, db);

    await setWebhook();
    await server({ security: false, session: false, port: process.env.PORT },
        [
            get("/ping", () => send("pong")),
            post(`/${process.env["TG_TOKEN"]}`, botHandler),
            error(({ url, error }) => status(500).type("text/plain").send(error?.message)),
        ]
    );
    console.log("web server inited!");

    // TO-DO: 
    // 1. add cache for update_id
    async function botHandler({ data: { update_id, message } }) {
        if (!message) return json({});
        const { chat, text = null } = message
        if (chat?.type !== "private") {
            sendMessage(chat.id, `Sorry. This bot does not work in ${chat.type}`);
            return json({});
        }
        console.log("[tgBot] ", chat?.id, text);
        switch (text) {
            case ("/start"): {
                sendMessage(chat.id, "Please go to https://github.com/lantica/chunigram for usage");
                break;
            }
            case ("/update"): {
                const result = await db.oneOrNone(`select "id" from "user" where "id" = $1`, chat.id);
                if (!result) {
                    await db.any(`insert into "user" ("id") values ($1)`, chat.id);
                }
                updateQueue.addJob({ chat_id: chat.id }, { jobId: update_id });
                break;
            }
            case ("/rating"): {
                try {
                    const { rating, maxRating, bestRating, standardDev } = await db.one(
                        `select "rating", "maxRating", "bestRating", "standardDev" from "user" where "id" = $1`,
                        chat.id
                    );
                    sendMessage(chat.id, `Current Rating: ${rating}\n` +
                        `Maximum Rating: ${maxRating}\n` +
                        `Best 30 Rating: ${bestRating}\n` +
                        `Estimated recent Rating: ${rating * 4 - bestRating * 3}\n` +
                        `Standard Deviation: ${standardDev}\n`
                    );
                } catch (e) {
                    sendMessage(chat.id, "Please update your score first!");
                }
                break;
            }
            case ("/best30"): {
                try {
                    const { bestSongs: { best30Songs } } = await db.one(`select "bestSongs" from "user" where "id" = $1`, chat.id);
                    const entries = best30Songs.map((song, idx) => [idx + 1, song]);
                    const payload1 = Object.fromEntries(entries.slice(0, 15));
                    const payload2 = Object.fromEntries(entries.slice(15,));
                    sendMessage(chat.id, JSON.stringify(payload1, null, 2));
                    await setTimeout(200);
                    sendMessage(chat.id, JSON.stringify(payload2, null, 2));
                } catch (e) {
                    sendMessage(chat.id, "Please update your score first!");
                }
                break;
            }
            case ("/potential"): {
                try {
                    const { altSongs: { alt10Songs } } = await db.one(`select "altSongs" from "user" where "id" = $1`, chat.id);
                    const payload = Object.fromEntries(alt10Songs.map((song, idx) => [idx + 1, song]));
                    sendMessage(chat.id, JSON.stringify(payload, null, 2));
                } catch (e) {
                    sendMessage(chat.id, "Please update your score first!");
                }
                break;
            }
            case ("/percentile"): {
                try {
                    const allRating = (await db.many(`select "rating" from "user" where "rating" is not null order by "rating" asc`))
                        .map(({ rating }) => rating);
                    const { rating: userRating } = await db.one(`select "rating" from "user" where "id" = $1`, chat.id);
                    const less = allRating.filter(r => r < userRating).length;
                    const same = allRating.filter(r => r === userRating).length;
                    sendMessage(chat.id, `Your rating is at ${Math.round((less + 0.5 * same) / allRating.length * 100)} percentile!`);
                } catch (e) {
                    sendMessage(chat.id, "Please update your score first!");
                }
                break;
            }
            case ("/beam"): {
                sendSticker(chat.id, "CAACAgUAAxUAAWCeScha8TFjT4VaXEno120UIOJwAAIVAAOhZV8Zq05ylhgRf8EfBA");
                break;
            }
            default: {
                tgEmitter.emit(`${chat.id}:message`, text);
            };
        }
        return json({});
    };
})();