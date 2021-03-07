function timeout(ms) {
    return new Promise(r => setTimeout(r, ms));
}

exports.timeout = timeout;