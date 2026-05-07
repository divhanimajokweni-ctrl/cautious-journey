const axios = require('axios');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function notifyCISO(reportPath, evaluation) {
    const message = `🚨 *JS2 CRITICAL INCIDENT* 🚨\n*CID:* ${evaluation.cid}\n*Risk:* ${evaluation.riskClass}\n*Action:* Transaction Halted\n*Report:* ${reportPath}`;
    try {
        await axios.post(process.env.SLACK_WEBHOOK_URL, { text: message });
    } catch (e) { console.error('Slack fail'); }

    const msg = {
        to: [process.env.CISO_EMAIL, 'ITandCybernotification@fsca.co.za'],
        from: process.env.VERIFIED_SENDER,
        subject: `[URGENT] JS2 Material Cyber Incident: CID ${evaluation.cid.slice(0,8)}`,
        text: `A Class B structural threat was intercepted by ProofBridge Liner.\n\nDetails: ${evaluation.riskClass}\nReport: ${reportPath}`,
        attachments: [{
            content: Buffer.from(require('fs').readFileSync(reportPath)).toString('base64'),
            filename: 'JS2_Incident_Report.txt',
            type: 'text/plain',
            disposition: 'attachment'
        }]
    };
    try { await sgMail.send(msg); } catch (e) { console.error('Email fail'); }
}
module.exports = { notifyCISO };