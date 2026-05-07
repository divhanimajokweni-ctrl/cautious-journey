const crypto = require('crypto');
function sanitizeForAudit(data) {
    const sensitive = ['ownerName', 'idNumber', 'propertyAddress', 'contactDetails'];
    const sanitized = { ...data };
    sensitive.forEach(field => {
        if (sanitized[field]) {
            sanitized[`${field}Hash`] = crypto.createHmac('sha256', process.env.SALT_SECRET || 'salt')
                .update(sanitized[field].toString()).digest('hex').slice(0, 16);
            delete sanitized[field];
        }
    });
    return sanitized;
}
module.exports = { sanitizeForAudit };