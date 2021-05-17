const Queue = require("bull");
const { sendMessage } = require("./telegram");
const { parse } = require("./parse");

const errorMsg = "Oops, something went wrong. Please try again.\n" +
    "If this message keeps appear, please contact the developer.";

module.exports = class UpdateQueue {
    constructor(redisURL, tgEmitter, redisInstance, postgreInstance) {
        this.tgEmitter = tgEmitter;
        this.redisInstance = redisInstance;
        this.db = postgreInstance;
        this.queue = new Queue("update", redisURL, {
            defaultJobOptions: {
                attempts: 1,
                removeOnComplete: true,
                removeOnFail: true,
                timeout: 5 * 60 * 1000
            }
        });
        this.queue.process(4, async (job) => {
            sendMessage(job.data.chat_id, "Please enter your ssid.");
            const input = await new Promise(r => this.tgEmitter.once(`${job.data.chat_id}:message`, (msg) => r(msg)));
            if (!/^[a-z0-9]{64}$/.test(input)) return Promise.reject("Invalid ssid!");
            await sendMessage(job.data.chat_id, "Parsing data from chunithm.net, please wait a moment");
            const result = await parse(input, redisInstance);
            return Promise.resolve(result);
        });
        this.queue.on("completed", (job, { best30Songs, best30Rating, currRating, maxRating, alt10Songs }) => {
            postgreInstance.none(`update "user" set "bestRating" = $2, "bestSongs" = $3, "rating" = $4,` +
                `"maxRating" = $5, "altSongs" = $6, "lastUpdated" = now() where "id" = $1`,
                [job.data.chat_id, best30Rating, { best30Songs }, currRating, maxRating, { alt10Songs }]
            );
            sendMessage(job.data.chat_id, "Updated successfully!");
        });
        this.queue.on("failed", (job, err) => {
            console.warn(`[update] Update job failed, ${job.data.chat_id}`, err);
            sendMessage(job.data.chat_id, errorMsg);
        });
    }

    addJob(data, opts) {
        this.queue.add(data, opts).catch(e => {
            sendMessage(data.chat_id, errorMsg);
            console.warn(e);
        });
    }
}
