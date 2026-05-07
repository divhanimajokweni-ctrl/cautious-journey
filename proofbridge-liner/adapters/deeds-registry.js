const axios = require('axios');
require('dotenv').config();

async function fetchDeedData(cid) {
    // Replace with real WinDeed / Lightstone API call in production
    return {
        cid,
        alpha: 12,
        beta: 1,
        mismatchCount: 1,
        teeValidated: true,
        isEDRS: false,
        registryStatus: 'OPEN'
    };
}
module.exports = { fetchDeedData };